var port;
var responseObject;

var grading=false;

//Data when grading:
var currentWindow;
var tab;
var responseCount;
var testCount=0;
var testTotal=0;

chrome.runtime.onConnect.addListener(function(portt){
	console.assert(portt.name == "MessageServer");
	portt.onMessage.addListener(function(response){
		processMessage(response)
	});
	port=portt;
});
chrome.notifications.onClicked.addListener(function(key) {focusGradeTab(key);});
function processMessage(request){
	if(request.status){
		responseObject={msg: request.status};
		processStatus(request.status,request);
	}
	if(request.prompt){
		responseObject={msg: request.prompt};
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
		chrome.windows.getCurrent(function(current){
			currentWindow=current;
		});
		responseCount=0;
		testCount=0;
		refreshProgress();
		responseObject.status=200; //200 meaning OK
		port.postMessage(responseObject);
	}
	else if(status==="Graded_Response"){
		if(grading){
			responseCount++;
		} //responsecount isnt guarenteed
	}
	else if(status==="Graded_Test"){
		if(grading){
			testCount++;
			var plural="";
			if(testCount>1)
				pural="s";
			var opt = {
				type: "progress",
				title: "Grading Test",
				message: "Grading Test "+(testCount)+"/"+testTotal,
				iconUrl: "icons/icon128.png",
				priority: 2,
				progress: Math.round(((testCount)/testTotal)*100)
			}
			chrome.notifications.create("Progress",opt, function(){});
		}
		responseObject.status=200;
		port.postMessage(responseObject); //test count is guarenteed
	}
	else if(status==="Finished_Grading"&&grading){
		grading=false;
		if(testCount>0) {
			gradingCompleted();
			responseObject.status=200; //OK
			port.postMessage(responseObject);
		}
		else {
			responseObject.status=204; //OK, No data (nothing was graded)
			port.postMessage(responseObject);
		}
	}
	else if(status==="Disable_Grading"||status==="Finished_Grading"){
		grading=false;
		responseObject.status=204; //OK, No data
		port.postMessage(responseObject);
	}
	else if(status==="TestTotal"){
		testTotal=event.info;
	}
	else{
		unknownMsg(status)
	}
}
function processPrompt(prompt){
	if(prompt==="grading?"){
		responseObject.prompt=grading;
		port.postMessage(responseObject);
	}
	else if(prompt==="tabStatus"){
		responseObject.prompt=tab.status;
		port.postMessage(responseObject);
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
	if(responseCount>1)
		rPlural="s";
	tPlural="";
	if(testCount>1)
		tPlural="s";

	var options = {
		type: "list",
		title: "Autograding Complete",
		message: "Autograding Complete",
		iconUrl: "icons/icon128.png",
		priority: 2, //Makes it show for 25 seconds before hiding
		isClickable: true,
		items: [{ title: "", message: "Graded "+responseCount+" response"+rPlural+" from "+testCount+" test"+tPlural+"."}
		]
	}
	chrome.notifications.clear("Progress",function(){});
	chrome.notifications.create("Complete",options, function(){});
	setTimeout(function(){chrome.notifications.clear("Complete",function(){})},25000); //remove from tray after 25 seconds
}
function focusGradeTab(key){
	chrome.windows.update(currentWindow.id,{focused: true}); //Focus Grading Window
	chrome.tabs.update(tab.id, {highlighted: true}); //Selects grading tab
	if(key=="Complete")
		chrome.notifications.clear(key,function(){}); //Clear notification
}
function refreshProgress(){
	setTimeout(function(){
		chrome.notifications.clear("Progress",function(){});
		if(grading){
			refreshProgress();
		}
		},24500); //remove from tray after 25 seconds
}