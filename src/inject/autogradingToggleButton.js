var toggle=document.getElementById("autogradingToggle");
function toggleAutograding(){
	var current=toggle.innerHTML;
	if(current=="Autograding Disabled") {
		toggle.innerHTML = "Autograding Enabled";
		toggle.style.background="#9ADA47";
		window.postMessage({ type: 'FROM_PAGE', text: 'Enable_Grading' }, '*')
	}
	else if(current=="Autograding Enabled"||current=="Error"){
		toggle.innerHTML = "Autograding Disabled";
		toggle.style.background="";
		window.postMessage({ type: 'FROM_PAGE', text: 'Disable_Grading' }, '*')
	}
	else{
		console.error("Unexpected value from InnerHTML of autograding toggle.")
	}
}