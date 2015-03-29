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
	message({prompt: "grading?"},function (response) {
		var grading=response.prompt;
		if(!grading){ //Should we autograde?
			console.warn("Autograding Disabled");
			return;
		}

		var gradeInputs = [];
		var gradeTotals = [];
		var responses = [];
		var answers = [];

		for(var i=0;true;i++){ //Increment until broken when we realize a element doesn't exist
			//Select input field element
			var input = $("input[id^='points__'][name^='score-override-_'][type='text']").get(i); //input element, id starts with 'points__', name starts with 'score-override-_', type=text
			//Select correct answer element
			var correct = $($("img + div.vtbegenerated > p").get(i)).text(); //p element with a parent of a div element with .vtbegenerated class, with the element above it being a image
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
		nextTest();
	});

	function grade(inputs,totals,responses,answers){
		for(var i=0;i<inputs.length;i++){
			var input=inputs[i];
			var total=totals[i];

			var response= $.unique(stem(responses[i])); //Stemmed without duplicates
			var answer= $.unique(stem(answers[i])); //Stemmed without duplicates

			var totalWords=answer.length;
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

			console.log("Stemmed Response: ");
			console.log(response);
			console.log("Stemmed Correct Answer: ");
			console.log(answer);

			$(input).val(score); //IF THIS HAPPENS TOO EARLY (Before theAttemptNavController loads) THE PAGE WILL NOT VALIDATE!

			console.log("Scored "+score+"/"+total+" because the following stems matched: ");
			console.log(matchingWords);
			console.log("and didn't match: ");
			console.log(nonmatchingWords)
		}
	}
	function nextTest(){
		//$('input.submit.button-1').click(); //ONLY WORKS IF THIS HAPPENS AFTER ALL OTHER SCRIPTS ON THE PAGE (theAttemptNavController has to be loaded)
		injectScript("src/inject/autogradeNext.js");
	}

}

/*###################
 //## Grade Center ##
 /#################*/
function gradeCenter(){
	$(document.body).bind("DOMSubtreeModified",function(){
		watchClick();
	}); //Every time the data changes, make sure we add our listener

	function watchClick(){ //If the popup is triggered we want to check if it contains a grade attempts button so we can inject a autograde button
		$("a[id^='cmlink_']").click(setupMenu());
	}
	function setupMenu(){
		menu=$("div.cmdiv"); //The created popup menu is a div with the class cmdiv
		if(menu && $(menu).length>0){ //Check if menu has been created
			linkBefore = $("div.cmdiv > ul > li > a:contains('Grade Attempts')");
			if(linkBefore.length>0)
				createLink($(linkBefore).first().parent());
		}
	}
	function createLink(linkBefore){ //Insert autograde link after linkBefore
		console.log($(linkBefore).attr("href"));
		if($(linkBefore).next().text()==="Autograde Attempts")
			return; //We already injected it
		var id=$(linkBefore).attr('id');
		var linkid=$(linkBefore).children().first().attr('id');
		//$('<li id="'+id+'"><a href="#" id="'+linkid+'" onclick="" title="Autograde Attempts">Autograde Attempts</a></li>').insertAfter(linkBefore); //Insert autograde button into list
	}
}

/*####################
//## Static Methods ##
####################*/

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