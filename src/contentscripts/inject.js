var port=chrome.runtime.connect({name: "MessageServer"});
$(document).ready(function(){
	main();
});

function main(){
	var page=detectPage();
	if(!page)
		return;
	console.log("Detected Page: "+page);
	if(page==="gradingMenu")
		gradingMenu();
	else if(page==="gradeTest")
		$(document).ready(function(){ //Need to wait until document is ready in order to ensure old value is set before changing value
			gradeTest();
		});
	else if(page=="gradeCenter")
		$(document).ready(function() {
			gradeCenter();
		});
}
function detectPage(){ //Detects page
	if(document.title === "Needs Grading"){
		return "gradingMenu";
	}
	else if((document.title).indexOf("Grade Test: ")===0) { //Title starts with 'Grade Test: '
		return "gradeTest";
	}
	else if(document.title ==="Grade Center"){
		return "gradeCenter";
	}
	stopAutograding(); //If we are on a unknown page we can assume that we can stop autograding
	return null;

}
/*##########################
//## Needs Grading Screen ##
/#########################*/

function gradingMenu() {
	var gradeAllButton;
	stopAutograding();
	findButton();
	setupEvent();
	setupMenu();
	watchChanges();

	function findButton(){
		gradeAllButton = $("#gradeAttemptButton");
	}
	function setupEvent() { //Create an event the webpage can call to tell us to start autograding
		window.addEventListener("message", function (event) {
			// We only accept messages from ourselves
			if (event.source != window) {
				console.warn("Event triggered from external source: '" + event.source + "' will be blocked.");
				return;
			}

			if (event.data.type && (event.data.type == "FROM_PAGE")) {
				console.log("Message Received by Inject Script : " + event.data.text);
				receiveEvent(event);
			}
		}, false);
	}

	function setupMenu() { //Handle injecting elements into page to create buttons
		var oldButton=$("#autogradeButton");
		if(oldButton)
			$(oldButton).remove();
		var onclick = "window.postMessage({ type: 'FROM_PAGE', text: 'Start_Grading' }, '*')"; //Call event from setupEvent() to get access to this script.
		var disable="";
		if($(gradeAllButton).attr("class")==="disabled"){ //Disable button if theres nothing to grade
			disable=" class=\"disabled\"";
			onclick="";
		}
		$('<li class="mainButton"><a id="autogradeButton"'+disable+' href="#" onclick="' + onclick + '")>Autograde All</a></li>').insertAfter(gradeAllButton.parent()); //Insert button after "Grade All" button
	}
	function watchChanges(){ //If the Grade All button changes (to be disabled), we want to disable the autograde button too.
		$(gradeAllButton).bind("DOMSubtreeModified", function(){
			findButton(); //Update variable with the changed button
			setupMenu();
		});
	}
	function receiveEvent(event) {
		if (event.data.text === "Start_Grading") {
			autograde();
		}
	}

	function autograde() { //Prepare background script for autograding
		console.log("Notifying background script we are starting grading.");
		message({status: "Starting_Grading"},function (response){
			if (response.status === 200) { //200 meaning OK
				gradeAttempt();
			}
			else {
				console.error("Error talking to background script: " + response.status);
			}
		});
	}

	function gradeAttempt() { //Start autograding
		console.log("Starting Grading");
		document.location.href = $(gradeAllButton).attr("href");//(Most reliable way of changing page) Terminates Script
	}
}

/*########################
//## Grade Test Screen ##
#######################*/

function gradeTest(){
	var injectResponded=false;
	var responeded=false;
	var hackInput;
	message({prompt: "grading?"},function (response) {
		if(responeded===true)
			return;
		responeded=true;
		var grading=response.prompt;
		if(grading===false){ //Should we autograde?
			console.warn("Autograding Disabled");
		}
		else {
			setupEvent();
			setupVisuals();
			searchTest();
		}
	});
	function setupVisuals(){
		var backgroundColor=$('body').css('background');
		backgroundColor=backgroundColor.substring(0,backgroundColor.indexOf(" url"));
		backgroundColor="rgba"+backgroundColor.substring(backgroundColor.indexOf("rgb")+3,backgroundColor.indexOf(")"))+",.3)";
		var inner="<div><h1 class='steptitle' style='font-size: 35pt;text-shadow:0 1px 0 #eee;'>Autograding</h1><br/>" +
			"<h1 class='steptitle' style='text-shadow:0 1px 0 #eee;font-size:20pt;'><a href=\"javascript:window.postMessage({ type: 'FROM_PAGE', text: 'Stop_Grading' }, '*')\">Stop Grading</a></h1></div>"
		var overlay=$("<div id='autogradeOverlay' style='background: "+backgroundColor+";bottom: 0;left: 0;position: fixed;right: 0;" +
		"top: 0;text-align:center;padding-top: 10%;padding-bottom:20%'>"+inner+"</div>").insertAfter($('body'));
	}
	function searchTest(){
		var counter=$('span.count').text();
		counter=counter.substring(counter.indexOf("of ")+3);
		message({status: "TestTotal",info: parseInt(counter)},function (response){});


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
		grade(gradeInputs, gradeTotals, responses, answers);
	}
	function grade(inputs,totals,responses,answers){
		for(var i=0;i<inputs.length;i++){
			var input=inputs[i];
			var total=totals[i];

			var response= $.unique(stem(responses[i])); //Stemmed without duplicates
			var answer= $.unique(stem(answers[i])); //Stemmed without duplicates

			var totalWords=answer.length;
			if(totalWords==0)
				totalWords=1;
			var matchingWords=[];
			var nonmatchingWords=[];
			answer.forEach(function(word){
				if($.inArray(word,response)!==-1){
					matchingWords.push(word);
				}
				else
					nonmatchingWords.push(word);
			});
			var score=(matchingWords.length/totalWords)*total+""; //Calculate score into a string so we can shorten it potentially
			if(score.length>10){ //Thats a problem because blackboard doesn't allow more than 10 characters to be submitted
				score=score.substring(0,10); //Only take the first 10 characters
			}
			if(i==0){
				score+="1"; //add a 1 to the end
				hackInput=input;
			}

			console.log("Stemmed Response: ");
			console.log(response);
			console.log("Stemmed Correct Answer: ");
			console.log(answer);

			$(input).val(score);

			if(i==0)
				score=score.substring(0,score.length-1);//Fix for command line output
			console.log("Scored "+score+"/"+total+" because the following stems matched: ");
			console.log(matchingWords);
			console.log("and didn't match: ");
			console.log(nonmatchingWords);

			message({status: "Graded_Response"},function (response){});
		}
		message({status: "Graded_Test"}, function(response){
			if (response.status === 200) { //200 meaning OK
				nextTest();
			}
			else {
				console.error("Error talking to background script: " + response.status);
			}
		});
	}
	function nextTest(){
		injectScript("src/inject/autogradeNext.js");//There is a bug in chrome when you are browsing in other tabs sometimes this call will be ignored...
		setTimeout(function(){
			if(!injectResponded)
				console.warn("Inject Failed, retrying...");
				nextTest();
		},1000);
		//setTimeout(function(){
		//	message({prompt: "tabStatus"}, function(response){
		//		console.log("Tab Status: "+response.prompt);
		//		if(response.prompt=="complete"){
		//			nextTest();
		//		}
		//	})
		//},250);
	}
	var ready=false;
	function setupEvent() { //Create an event the webpage can call to tell us to start autograding
		window.addEventListener("message", function (event) {
			// We only accept messages from ourselves
			if (event.source != window) {
				console.warn("Event triggered from external source: '" + event.source + "' will be blocked.");
				return;
			}

			if (event.data.type && (event.data.type == "FROM_PAGE")) {
				if(event.data.text=="ReadyForNext"||event.data.text=="NotReady")
					injectResponded=true;
				if(event.data.text=="ReadyForNext"&&!ready){
					ready=true;//only call once

					var score=($(hackInput).val());
					score=score.substring(0,score.length-1);//fix hack
					$(hackInput).val(score); //If theAttemptNavigator wasn't loaded when the value was set it thinks the value hasn't been changed.
					$('input.submit.button-1').click(); //If theAttemptNavigator has not been loaded will go to Forbidden Page
				}
				else if(event.data.text=="Stop_Grading"){
					$("#autogradeOverlay").remove();
					message({status: "Finished_Grading"},function (response){
						if (response.status !== 200) { //200 meaning OK
							console.error("Error talking to background script: " + response.status);
						}
						else{
							$("#autogradeOverlay").remove();
						}
					});
				}

			}
		}, false);
	}

}

/*###################
 //## Grade Center ##
 /#################*/
function gradeCenter(){
	stopAutograding();
	checkPage();
	setupEvent();
	injectToggle();

	function checkPage(){ //Check if it is the assignments grade center page, if it is, don't show the autograde toggle
		$("#pageTitleDiv").bind("DOMSubtreeModified", function(){
			var text=$("#pageTitleText").text();
			if(text.indexOf("Assignments")>-1){ //We are on the assignments grade center page
				$("#autogradingToggle").remove();
			}
		});
	}
	function injectToggle(){
		var buttonBefore=$('.sub.primary').first();
		injectScript("src/inject/autogradingToggleButton.js");
		$('<li><a id="autogradingToggle" class="sub primary" href="javascript:toggleAutograding()">Autograding Disabled</a></li>').insertAfter(buttonBefore);
	}

	function setupEvent() { //Create an event the webpage can call to tell us to start autograding
		window.addEventListener("message", function (event) {
			// We only accept messages from ourselves
			if (event.source != window) {
				console.warn("Event triggered from external source: '" + event.source + "' will be blocked.");
				return;
			}

			if (event.data.type && (event.data.type == "FROM_PAGE")) {
				console.log("Message Received by Inject Script : " + event.data.text);
				receiveEvent(event);
			}
		}, false);
	}
	function receiveEvent(event){
		if (event.data.text === "Enable_Grading") {
			autograde(true);
		}
		else if(event.data.text === "Disable_Grading"){
			autograde(false);
		}
	}
	function autograde(enable) { //Prepare background script for autograding
		var toggle=$("#autogradingToggle");
		if(enable){
			message({status: "Enable_Grading"},function (response){
				if (response.status !== 200) { //200 meaning OK
					console.error("Error talking to background script: " + response.status);
					toggle.text("Error");
					toggle.style.background="#CC3300"
				}
			});
		}
		else{
			message({status: "Disable_Grading"},function (response){
				if (response.status !== 200) { //200 meaning OK
					console.error("Error talking to background script: " + response.status);
					toggle.text("Error");
					toggle.style.background="#CC3300"
				}
			});
		}

	}
}

/*####################
//## Static Methods ##
####################*/

function stopAutograding(){
	console.log("Notifying background script we have completed grading.");
	message({status: "Finished_Grading"},function (response){
		if (response.status === 200) { //200 meaning OK
		}
		else {
			console.error("Error talking to background script: " + response.status);
		}
	});
}
function message(msg, response){
	port.postMessage(msg);
	port.onMessage.addListener(response);
}
function injectScript(scriptLoc){
	var s = document.createElement('script');
	s.src = chrome.extension.getURL(scriptLoc);
	s.onload = function() {
		this.parentNode.removeChild(this);
	};
	(document.head||document.documentElement).appendChild(s);
}
function stem(str){
	str=str.toLowerCase();
	str=str.replace(/\W+/g, " "); //Replace all non alphanumeric characters with a space
	str=str.removeStopWords();
	if(!str) {
		str = "";
	}
	var words=str.split(" ");
	if(!words){
		return [];
	}
	var stems=[];
	for(var x=0;x<words.length;x++){
		var stem= stemmer(words[x]); //Stem word
		if(stem) { //If stem isn't empty
			stems.push(stem);
		}
	}
	return stems;
}