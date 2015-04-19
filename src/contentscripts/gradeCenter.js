/*###################
 //## Grade Center ##
 /#################*/

//Script for the Grading Center pages in blackboard
//Simply injects a toggle to set the variable grading in the background script to true or false

//Depends upon inject.js

function gradeCenter(){
	stopAutograding(); //If we reach this page we may have finished a grading queue
	checkPage(); //Remove toggle button if it is assignments page because we don't autograde assignments
	setupEvent(); //Inject event into webpage so webpage can interface with this script
	injectToggle(); //Inject button to toggle autograding

	function checkPage(){ //Check if it is the assignments grade center page, if it is, don't show the autograde toggle
		$("#pageTitleDiv").bind("DOMSubtreeModified", function(){
			var text=$("#pageTitleText").text();
			if(text.indexOf("Assignments")>-1){ //We are on the assignments grade center page
				$("#autogradingToggle").remove();
			}
		});
	}
	function injectToggle(){ //Inject autograding button toggle
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
	function receiveEvent(event){ //Called from autograding toggle when it is clicked on the page
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
				if (response.status !== 200) { //2xx meaning OK
					console.error("Error talking to background script: " + response.status);
					toggle.text("Error");
					toggle.style.background="#CC3300"; //Red
				}
			});
		}
		else{
			message({status: "Disable_Grading"},function (response){
				if (response.status !== 200&&response.status!==204) { //2xx meaning OK
					console.error("Error talking to background script: " + response.status);
					toggle.text("Error");
					toggle.style.background="#CC3300"; //Red
				}
			});
		}

	}
}