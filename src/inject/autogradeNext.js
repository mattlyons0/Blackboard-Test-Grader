check();

function check() {
	if (theAttemptNavController) {
		window.postMessage({type: 'FROM_PAGE', text: 'ReadyForNext'}, '*');
	}
	else{
		window.postMessage({type: 'FROM_PAGE', text: 'NotReady'}, '*');
		console.log("Waiting for page to load.");
		setTimeout(function(){check()},250);
	}

}