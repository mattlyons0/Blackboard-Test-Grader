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
	backgroundColorA="rgba"+backgroundColor.substring(backgroundColor.indexOf("rgb")+3,backgroundColor.indexOf(")"))+",.8)"; //Apply a overlay at 80% opacity of that color
	borderColor=colorBrightness(rgb2hex(backgroundColor),-15); //Calculate border color by darkening the background of the panel

	var content="<h1>Autograding Summary</h1> <div id='autogradeSumContent'>Generating Summary...</div>";

	//Create HTML Elements and add them
	var contentPane="<div class='container' id='summaryContent' onclick='event.stopPropagation();' " + //Don't remove if this is clicked
		"style='min-height:25%;border-radius: 10px;border: 2px solid "+borderColor+";'>"+content+"</div>";
	var overlay=$("<div id='summaryOverlay' onclick='this.remove();'" + //Remove self when clicked (but not when inner elem is clicked)
	" style='background: "+backgroundColorA+";bottom: 0;left: 0;position: fixed;right: 0;top: 0;text-align:center;" +
	"padding:10%; z-index:1000'>"+contentPane+"</div>").insertAfter($('body'));

	//Gather data
	message({prompt: "data"}, function (resp){
		var tests=resp.testCount;
		var responses=resp.responseCount;
		var matchingStems=resp.matchingStems;
		var nonmatchingStems=resp.nonmatchingStems;
		var testGrades=resp.grades;
		var testTotals=resp.totalGrades;
		var testNames=resp.testNames;
		var numQuestions=resp.numQuestions;

		//Parse Data
		var totalPoints=0;
		for(var i=0;i<tests;i++){
			totalPoints+=testGrades[i];
		}
		var testAverage=totalPoints/tests;

		//Display Data
		var s="";
		if(tests>1) s="s";
		var rs="";
		if(responses>1) rs="s";
		var totalString="Graded "+tests+" test"+s+" and "+responses+" response"+rs+". Averaging "+(responses/tests)+" response"+((responses/tests)>1?"s":"")+" per test.";
		var gradeString="The average score was "+testAverage;

		//Update Output
		$("#autogradeSumContent").html(totalString+"<br/>"+gradeString);
	});


}
//http://stackoverflow.com/questions/5560248/programmatically-lighten-or-darken-a-hex-color
function colorBrightness(col, amt) {
	var usePound = false;
	if (col[0] == "#") {
		col = col.slice(1);
		usePound = true;
	}
	var num = parseInt(col,16);
	var r = (num >> 16) + amt;
	if (r > 255) r = 255;
	else if  (r < 0) r = 0;
	var b = ((num >> 8) & 0x00FF) + amt;
	if (b > 255) b = 255;
	else if  (b < 0) b = 0;
	var g = (num & 0x0000FF) + amt;
	if (g > 255) g = 255;
	else if (g < 0) g = 0;
	return (usePound?"#":"") + (g | (b << 8) | (r << 16)).toString(16);
}
//http://stackoverflow.com/questions/1740700/how-to-get-hex-color-value-rather-than-rgb-value
var hexDigits = new Array
("0","1","2","3","4","5","6","7","8","9","a","b","c","d","e","f");
//Function to convert hex format to a rgb color
function rgb2hex(rgb) {
	rgb = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
	return "#" + hex(rgb[1]) + hex(rgb[2]) + hex(rgb[3]);
}
function hex(x) {
	return isNaN(x) ? "00" : hexDigits[(x - x % 16) / 16] + hexDigits[x % 16];
}