var debug=true;

var port;

var grading=debug;

chrome.runtime.onConnect.addListener(function(portt){
	console.assert(portt.name == "MessageServer");
	portt.onMessage.addListener(function(response){
		processMessage(response)
	});
	port=portt;
});

function processMessage(request){
	if(request.status!=null){
		processStatus(request.status);
	}
	if(request.prompt!=null){
		processPrompt(request.prompt);
	}
	if(request.prompt==null&&request.status==null){
		unknownMsg(request)
	}
}
function processStatus(status){
	if(status === "Starting_Grading"){
		grading=true;
		port.postMessage({status: 200}); //200 meaning OK
	}
	else if(status === "Finished_Grading"){
		grading=false;
		port.postMessage({status: 200});
	}
	else{
		unknownMsg(status)
	}
}
function processPrompt(prompt){
	if(prompt==="grading?"){
		port.postMessage({prompt: grading})
	}
	else{
		unknownMsg(prompt)
	}
}

function unknownMsg(request){
	console.warn("A unknown message was received: "+request);
}