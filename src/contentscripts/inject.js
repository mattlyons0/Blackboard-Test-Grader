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
	" style='background: "+backgroundColorA+";bottom: 0;left: 0;position: absolute;height:100%;right: 0;top: 0;text-align:center;" +
	"padding:10%; z-index:1000'>"+contentPane+"</div>").insertAfter($('body'));

	//Gather data
	message({prompt: "data"}, function (resp){
		var totalTests=resp.testCount;
		var totalResponses=resp.responseCount;
		var matchingStems=resp.matchingStems;
		var nonmatchingStems=resp.nonmatchingStems;
		var testGrades=resp.grades;
		var testTotals=resp.totalGrades;
		var testNames=resp.testNames;
		var numQuestions=resp.numQuestions;
		var respTotals=resp.responseTotals;
		var respScores=resp.responseScores;

		//Parse Data

		//Separate Different Tests
		var testData=[];//Holds the data from each type of test
		var testNamescopy=testNames.slice(0); //Clone it because $.unique mutates the argument
		var tests= $.unique(testNames);//Contains the different types of tests
		testNames=testNamescopy;
		for(var i=0;i<tests.length;i++) { //Make testData an array for each test type
			testData.push({testName: tests[i]});
		}
		var responseCount=0;
		for(var i=0;i<totalTests;i++){
			var test=tests.indexOf(testNames[i]);
			var data=testData[test];
			data.numQuestions=numQuestions[i];
			data.total=testTotals[i];
			if(!data.responses) {
				data.responses = [];
				for(var z=0;z<data.numQuestions;z++){
					data.responses.push({total: respTotals[responseCount], response: []});
				}
			}
			for(var x=0;x<numQuestions[i];x++){

				var response={matching: matchingStems[responseCount],nonmatching: nonmatchingStems[responseCount],score: respScores[responseCount]};
				data.responses[x].response.push(response);
				responseCount++;
			}
		}
		console.log(testData); //Uncomment to see testData structure

		//Display Data
		var summary="Graded ";
		if(testData.length>1){
			summary+=testData.length+" different tests, ";
		}
		summary+=totalTests+" attempt"+(totalTests>1?"s":"")+" and "+totalResponses+" response"+(totalResponses>1?"s.":".");

		var testSum=[];
		for(var i=0;i<testData.length;i++){
			var data=testData[i];
			var str="<div style='background:rgba(0,0,0,.05);border-radius: 10px;border: 1px solid rgba(0,0,0,.1);padding:0 15px 15px 15px;" +
				"margin-top:15px;'><h2>"+data.testName+"</h2>";
			var totalAttempts=data.responses[0].response.length;
			var totalResponses=0;
			var points=[];
			for(var x=0;x<data.responses.length;x++){
				totalResponses+=data.responses[x].response.length;
				for(var y=0;y<data.responses[x].response.length;y++){
					points.push(data.responses[x].response[y].score);
				}
			}
			var statTable="<table style='width:100%;table-layout:fixed;'><tr><td align='center' style='width:50%'>Attempts: "+totalResponses/data.numQuestions+"</td><td align='center'>Responses: "+totalResponses+"</td></tr>"+
				"<tr><td align='center'>Average Score: "+parseFloat((math.sum(points)/totalAttempts).toFixed(4))+"/"+data.total+"</td><td align='center'>" +
				"Median Score: "+parseFloat(math.median(points).toFixed(4))+"/"+data.total+"</td></tr></table>";
			str+=statTable;
			for(var x=0;x<data.responses.length;x++){
				var qStr="<div style='background:rgba(0,0,0,.05);border-radius: 10px;border: 1px solid rgba(0,0,0,.1);padding:0 15px 15px 15px;" +
					"margin-top:15px;'><h3>Question "+(x+1)+"</h3><table style='width:100%; table-layout:fixed;;'><tr>";
				var pointTotal=data.responses[x].total;
				var questions=data.responses[x].response;
				points=[];
				var totalStems= $.merge((questions[0].matching.slice(0)),questions[0].nonmatching);
				$.unique(totalStems);

				var totalMatchingStems=[];
				var totalNonmatchingStems=[];
				for(var y=0;y<questions.length;y++){
					points.push(questions[y].score);
					$.merge(totalMatchingStems,$.unique((questions[y].matching).slice(0)));
					$.merge(totalNonmatchingStems,$.unique((questions[y].nonmatching).slice(0)));
				}
				console.log(totalMatchingStems);
				qStr+="<td align='center' style='width:50%'>Average Score: "+parseFloat((math.sum(points)/questions.length).toFixed(4))+"/"+pointTotal+"</td><td align='center'>" +
				"Median Score: "+parseFloat(math.median(points).toFixed(4))+"/"+pointTotal+"</td></tr></table>";

				var stemMatchPercentage=[];
				for(var y=0;y<totalStems.length;y++){
					//Count match percentage and save it in variable
					var count=0;
					var total=questions.length;
					for(var z=0;z<totalMatchingStems.length;z++){
						if(totalMatchingStems[z]===totalStems[y]){
							count++;
						}
					}
					stemMatchPercentage.push({stem: totalStems[y],match: count/total});
				}
				stemMatchPercentage.sort(function(a,b){
					return b.match - a.match;
				});
				qStr+="<br/><table style='width:75%;margin:auto;table-layout:fixed;'><tr><td align='center' style='width:50%'><b>Most Commonly Matching Stems</b></td><td align='center'><b>Least Commonly Matching Stems</b></td></tr>";
				for(var y=0;y<stemMatchPercentage.length;y++){
					if(y==10){
						var id="RestOfTable"+data.testName+x;
						var showMoreId="showmore"+data.testName+x;
						qStr+="<tr id='"+showMoreId+"'><td colspan='2' align='center'><a href='#' onclick=\"document.getElementById('"+id+"').style.display='table-row-group';" +
						"document.getElementById('"+showMoreId+"').remove();scrollTo();\">Show More</a></td></tr><tbody id='"+id+"' style='display:none;'>"
					}
					qStr+="<tr><td align='center'>\""+stemMatchPercentage[y].stem+"\" ("+parseFloat((stemMatchPercentage[y].match*100).toFixed(2))+"%)</td><td align='center'>"+
					stemMatchPercentage[stemMatchPercentage.length-1-y].stem+"\" ("+parseFloat((stemMatchPercentage[stemMatchPercentage.length-1-y].match*100).toFixed(2))+"%)</td></tr>";
					if(y==stemMatchPercentage.length-1&&y>=10){
						qStr+="</tbody>"
					}
				}
				qStr+="</table></div>";
				str+=qStr;
			}
			testSum.push(str+"</div>");
		}

		//Update Output
		for(var i=0;i<testSum.length;i++){
			summary+=testSum[i];
		}
		$("#autogradeSumContent").html(summary);
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