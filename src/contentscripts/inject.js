var port=chrome.runtime.connect({name: "MessageServer"}); //Create server to talk between this script and background script
$(document).ready(function(){
	main();
});

//Detect current page on blackboard and determine if it is a page we do something with.
function main(){ //Probably should use case switch
	var page=detectPage();
	if(!page){
		stopAutograding(); //If we are on a unknown page we can assume that we can stop autograding if it is enabled
		return;
	}
	if(page==="gradingMenu") {
		gradingMenu();
		return;
	}
	else if(page==="gradeTest") {
		gradeTest();
		return;
	}
	else if(page=="gradeCenter") {
		gradeCenter();
		return;
	}

	console.warn("The page: '"+page+"' was identified but not detected!"); //If we don't care about it, the page should be null
	stopAutograding();
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

/*####################
//## Static Methods ##
####################*/
//Tells background script to stop autograding if we still are, if we aren't no effect.
function stopAutograding(){ //If we finish autograding with anything other than this we must implement hookSummary() manually.
	console.log("Notifying background script we have completed grading.");
	message({status: "Finished_Grading"},function (response){
		if (response.status === 204) { //204 meaning OK, but nothing was graded
		}
		else if(response.status===200){ //200 meaning OK, and that we graded something
			hookSummary(); //We graded something, show the grading summary.
		}
		else {
			console.error("Error talking to background script: " + response.status);
		}
	});
}
//Send message to background script and call response once it responds.
//Guarentees only one delivery and determines the proper message
function message(msg, response){
	port.postMessage(msg);
	port.onMessage.addListener(function (resp){
		if((msg.status&&resp.msg===msg.status)||msg.prompt&&resp.msg===msg.prompt) { //If the response.msg is the same as the call, we know it is directed towards this function
			response(resp);
			port.onMessage.removeListener(this);
		}
		else{
			console.log("Blocked: ");
			console.log(resp);
			console.log("From: ");
			console.log(msg);
		}
	});
}
//Inject script element into webpage and run that script. Remove after it runs.
function injectScript(scriptLoc){
	var s = document.createElement('script');
	s.src = chrome.extension.getURL(scriptLoc);
	s.onload = function() {
		this.parentNode.removeChild(this);
	};
	(document.head||document.documentElement).appendChild(s);
}
//removes non alphanumeric characters, converts to lowercase, removes stopwords, runs through stemmer and returns array of stems
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
function hookSummary(){ //Method that will be called when we finish grading and will inject the summary into any page.
	var backgroundColor=$('body').css('background'); //Get the background color from the blackboard shell
	backgroundColor=backgroundColor.substring(0,backgroundColor.indexOf(" url")); //Get the color from the background
	backgroundColor="rgba"+backgroundColor.substring(backgroundColor.indexOf("rgb")+3,backgroundColor.indexOf(")"))+",.8)"; //Apply a overlay at 80% transparency of that color
	//Create and make it remove itself onclick
	var overlay=$("<div id='summaryOverlay' onclick='document.getElementById(\"summaryOverlay\").remove();' style='background: "+backgroundColor+";bottom: 0;left: 0;position: fixed;right: 0;" +
	"top: 0;text-align:center;padding-top: 10%;padding-bottom:20%; z-index:1000'></div>").insertAfter($('body'));
}