var port;

var grading=false;

//Data when grading:
var tab;
var responseCount;
var testCount;

chrome.runtime.onConnect.addListener(function(portt){
	console.assert(portt.name == "MessageServer");
	portt.onMessage.addListener(function(response){
		processMessage(response)
	});
	port=portt;
});

function processMessage(request){
	if(request.status!=null){
		processStatus(request.status,request);
	}
	if(request.prompt!=null){
		processPrompt(request.prompt);
	}
	if(request.prompt==null&&request.status==null){
		unknownMsg(request)
	}
}
function processStatus(status,event){
	if(status === "Starting_Grading"||status=== "Enable_Grading"){
		grading=true;
		chrome.tabs.query({ currentWindow: true, active: true }, function (tabs) {
			tab=tabs[0];
		});
		responseCount=0;
		testCount=0;
		port.postMessage({status: 200}); //200 meaning OK
	}
	else if(status==="Graded_Response"){
		if(grading){
			responseCount++;
		} //responsecount isnt guarenteed
	}
	else if(status==="Graded_Test"){
		if(grading){
			testCount++;
		}
		port.postMessage({status: 200}); //test count is guarenteed
	}
	else if(status==="Finished_Grading"&&grading){
		grading=false;
		if(testCount>0)
			gradingCompleted();
		port.postMessage({status: 200});
	}
	else if(status==="Disable_Grading"||status==="Finished_Grading"){
		grading=false;
		port.postMessage({status: 200});
	}
	else{
		unknownMsg(status)
	}
}
function processPrompt(prompt){
	if(prompt==="grading?"){
		port.postMessage({prompt: grading});
	}
	else{
		unknownMsg(prompt)
	}
}

function unknownMsg(request){
	console.warn("A unknown message was received: "+request);
}

function gradingCompleted(){
	rPlural="";
	if(responseCount>0)
		rPlural="s";
	tPlural="";
	if(testCount>0)
		tPlural="s";

	var options = {
		type: "list",
		title: "Autograding Complete",
		message: "Autograding Complete",
		iconUrl: "icons/icon128.png",
		priority: 2, //Makes it show for 25 seconds before hiding
		eventTime: 24500, //Delete it after 24.5 seconds so it doesn't go into the tray
		isClickable: true,
		items: [{ title: "", message: "Graded "+responseCount+" response"+rPlural+" from "+testCount+" test"+tPlural+"."}
		]
	}
	chrome.notifications.create("Complete",options, function(){});
	chrome.notifications.onClicked.addListener(function(key) {focusGradeTab(key);});
}
function focusGradeTab(key){
	if(key=="Complete") {
		chrome.tabs.update(tab.id, {highlighted: true}); //Selects grading tab
		chrome.notifications.clear(key,function(){}); //Clear notification
	}
}