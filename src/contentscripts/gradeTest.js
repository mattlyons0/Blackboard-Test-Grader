/*########################
 //## Grade Test Screen ##
 #######################*/

//Grades free response fields in tests
//Grade is assigned using stems from correct answer and checking if those stems exist in the attempt.
//Credit is given based on (correct stems in attempt/total stems * question point value)
//Progresses to next question in queue after grading is complete and necessary scripts from the webpage have loaded.

//Depends upon inject.js

function gradeTest(){
	var injectResponded=false; //We succeeded at injecting our script into the webpage to check if the necessary script loaded
	var responded=false; //We got a response from the background about if we are grading
	var hackInput; //Input field that we will change at the very end to prevent grade not saving as a result of inproperly caching (since we change the value before the script potentially loads)
	var questions; //Number of questions in this test
	message({prompt: "grading?"},function (response) {
		if(responded===true) //If this isn't here the function will respond multiple times and result in grading many times
			return;
		responded=true;
		var grading=response.prompt;
		if(grading===false){ //Should we autograde?
			console.warn("Autograding Disabled");
		}
		else {
			setupEvent(); //Event for webpage to talk to this script
			setupVisuals(); //Overlay that prevents clicking and adds a button to stop grading.
			searchTest(); //Search for tests to grade, then grade them.
		}
	});
	function setupVisuals(){ //Overlay that prevents clicking and adds link to stop grading.
		var backgroundColor=$('body').css('background'); //Get the background color from the blackboard shell
		backgroundColor=backgroundColor.substring(0,backgroundColor.indexOf(" url")); //Get the color from the background
		backgroundColor="rgba"+backgroundColor.substring(backgroundColor.indexOf("rgb")+3,backgroundColor.indexOf(")"))+",.4)"; //Apply a overlay at 40% opacity of that color

		//Create message and link to stop grading
		var inner="<div><h1 class='steptitle' style='font-size: 35pt;text-shadow:0 1px 0 #eee;'>Autograding</h1><br/>" +
			"<h1 class='steptitle' style='text-shadow:0 1px 0 #eee;font-size:20pt;'><a href=\"javascript:window.postMessage({ type: 'FROM_PAGE', text: 'Stop_Grading' }, '*')\">Stop Grading</a></h1></div>"
		var overlay=$("<div id='autogradeOverlay' style='background: "+backgroundColor+";bottom: 0;left: 0;position: fixed;right: 0;" +
		"top: 0;text-align:center;padding-top: 10%;padding-bottom:20%; z-index:1000'>"+inner+"</div>").insertAfter($('body'));
	}
	function searchTest(){
		var counter=$('span.count').text(); //Grab test number in queue
		counter=counter.substring(counter.indexOf("of ")+3);
		var testName=$("#pageTitleText").text();
		testName=testName.substring(testName.indexOf(": ")+2);
		message({status: "TestTotal",info: parseInt(counter),test: testName},function (response){}); //Tell background script what test we are on to update progress notification


		var gradeInputs = [];
		var gradeTotals = [];
		var responses = [];
		var answers = [];

		for(var i=0;true;i++){ //Increment until broken when we realize a element doesn't exist
			//Select input field element
			var input = $("input[id^='points__'][name^='score-override-_'][type='text']").get(i); //input element, id starts with 'points__', name starts with 'score-override-_', type=text
			//Select correct answer element
			var correct = $($("img[alt='Correct'] + div.vtbegenerated").get(i)).text(); //a div element with .vtbegenerated class, with the element above it being a image
			//Select the attempt answer element
			var given = $($("td:contains('Given Answer:') + td").get(i)).text(); //td element with the previous element being a td with the string containing 'Given Answer:'
			if($.trim(given)==="[None Given]")
				given="";

			if(!input)
				break; //Exit loop, we have run out of questions to grade.

			gradeInputs.push(input);
			answers.push(correct);
			responses.push(given);

			//Calculate total points the free response is out of
			var label = $($(gradeInputs).parent("label").get(i)).text(); //get the label text which is the parent element of the input field
			label = label.replace(/[^0-9]/g, ''); //remove everything that isn't a number
			gradeTotals.push(parseInt(label));
		}
		console.log("Grading "+gradeInputs.length+" responses.");
		questions=gradeInputs.length;
		grade(gradeInputs, gradeTotals, responses, answers);
	}
	function grade(inputs,totals,responses,answers){
		for(var i=0;i<inputs.length;i++){
			var input=inputs[i];
			var total=totals[i];

			var response= $.unique(stem(responses[i])); //Stemmed without duplicates
			var answer= $.unique(stem(answers[i])); //Stemmed without duplicates

			var totalWords=answer.length; //Number of stems in answer
			if(totalWords==0)
				totalWords=1; //Just in case there is no specified answer we don't want to give NaN
			var matchingWords=[];
			var nonmatchingWords=[];
			answer.forEach(function(word){
				if($.inArray(word,response)!==-1){
					matchingWords.push(word);
				}
				else
					nonmatchingWords.push(word);
			});
			//Calculate score
			var score=(matchingWords.length/totalWords)*total+""; //Calculate score into a string so we can shorten it potentially
			if(score.length>10){ //Thats a problem because blackboard doesn't allow more than 10 characters to be submitted
				score=score.substring(0,10); //Only take the first 10 characters
			}
			if(i==0){ //If this is the first score we apply our hack to get past cache
				score+="1"; //add a 1 to the end of the string (note this makes it 1 character too long)
				hackInput=input;
			}

			console.log("Stemmed Response: ");
			console.log(response);
			console.log("Stemmed Correct Answer: ");
			console.log(answer);

			$(input).val(score);

			if(i==0)
				score=score.substring(0,score.length-1);//Remove hack for command line output
			console.log("Scored "+score+"/"+total+" because the following stems matched: ");
			console.log(matchingWords);
			console.log("and didn't match: ");
			console.log(nonmatchingWords);

			message({status: "Graded_Response",matching: matchingWords,nonmatching:nonmatchingWords},function (response){}); //Tell background script we graded a response so it can keep count
		}
		message({status: "Graded_Test",grade:score,total: total,numQuestions: questions.length}, function(response){ //Tell background script we graded a test so it can keep track
			if (response.status === 200) { //200 meaning OK
				nextTest();
			}
			else {
				console.error("Error talking to background script: " + response.status);
			}
		});
	}
	function nextTest(){ //Progress in the queue to the next test (needs to be 100% reliable otherwise it will get stuck)
		injectScript("src/inject/autogradeNext.js");//There is a bug in chrome when you are browsing in other tabs sometimes this call will be ignored...
		setTimeout(function(){ //If it was ignored we will not get injectResponded to be true and we will try again.
			if(!injectResponded)
				console.warn("Inject Failed, retrying...");
			nextTest();
		},1000);
		//Injecting that script will call our event in setupEvent() telling if we are ready to go the next page or not
	}
	var ready=false;
	function setupEvent() { //Create an event the webpage can call to tell us to start autograding
		window.addEventListener("message", function (event) {
			// We only accept messages from ourselves
			if (event.source != window) {
				console.warn("Event triggered from external source: '" + event.source + "' will be blocked.");
				return;
			}

			if (event.data.type && (event.data.type == "FROM_PAGE")) { //We got a response from our injected script
				if(event.data.text=="ReadyForNext"||event.data.text=="NotReady")
					injectResponded=true;
				if(event.data.text=="ReadyForNext"&&!ready){ //We are ready to click next
					ready=true;//only call once

					var score=($(hackInput).val());
					score=score.substring(0,score.length-1);//fix our cache hack (remove the last character from the string)
					$(hackInput).val(score); //If theAttemptNavigator wasn't loaded when the value was set it thinks the value hasn't been changed.
					$('input.submit.button-1').click(); //If theAttemptNavigator has not been loaded will go to Forbidden Page (but our script has confirmed that it has loaded)
				}
				else if(event.data.text=="Stop_Grading"){ //The stop grading link was clicked
					$("#autogradeOverlay").remove(); //Remove overlay on current page
					message({status: "Finished_Grading"},function (response){ //Tell the background script to stop grading
						if (response.status==204) { //2xx meaning OK
							hookSummary();
						}
						else if(response.status==200){}
						else{
							console.error("Error talking to background script: " + response.status);
							return;
						}
						$("#autogradeOverlay").remove(); //Remove overlay on current page now, potentially later than first call
					});
				}

			}
		}, false);
	}

}