/*##########################
 //## Needs Grading Screen ##
 /#########################*/

//Adds autograde all button to the needs grading page of blackboard
//Disables that link if there is nothing to grade and the grade all button is disabled

//Depends upon inject.js

function gradingMenu() {
	var gradeAllButton;
	stopAutograding();
	findButton();
	setupEvent();
	setupMenu();
	watchChanges();

	function findButton(){ //Locate latest version of the button
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