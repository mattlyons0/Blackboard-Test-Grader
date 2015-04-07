var port=chrome.runtime.connect({name: "MessageServer"}); //Create server to talk between this script and background script
$(document).ready(function(){
	main();
});

//Detect current page on blackboard and determine if it is a page we do something with.
function main(){ //Probably should use case switch
	var page=detectPage();
	if(!page)
		return;
	console.log("Detected Page: "+page);
	if(page==="gradingMenu")
		gradingMenu();
	else if(page==="gradeTest")
		gradeTest();
	else if(page=="gradeCenter")
		gradeCenter();
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
	stopAutograding(); //If we are on a unknown page we can assume that we can stop autograding if it is enabled
	return null;

}

/*####################
//## Static Methods ##
####################*/
//Tells background script to stop autograding if we still are, if we aren't no effect.
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
//Send message to background script and call response once it responds.
function message(msg, response){
	port.postMessage(msg);
	port.onMessage.addListener(response);
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