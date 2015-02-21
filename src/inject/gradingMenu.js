function gradingMenu() {
    alert("HELLO")
    var gradeAllButton = $("#gradeAttemptButton");

    setupEvent();
    setupMenu();

    function setupEvent() {
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

    function setupMenu() { //Handle injecting elements into page to create buttons
        var onclick = "window.postMessage({ type: 'FROM_PAGE', text: 'Start_Grading' }, '*')"; //Call event from setupEvent() to get access to inject script.
        $('<li class="mainButton"><a id="autogradeButton" href="#" onclick="' + onclick + '")>Autograde All</a></li>').insertAfter(gradeAllButton.parent()); //Insert button after "Grade All" button
    }

    function receiveEvent(event) {
        if (event.data.text === "Start_Grading") {
            autograde();
        }
    }

    function autograde() { //Prepare background script for autograding
        console.log("Notifying background script we are starting grading.");
        chrome.runtime.sendMessage({status: "Starting_Grading"}, function (response) {
            if (response.status === 200) { //200 meaning OK
                gradeAttempt();
            }
            else {
                console.error("Error talking to background script: " + response.status);
            }
        });
    }

    function gradeAttempt() { //Start autograding
        console.log("Starting Grading");
        $(document).ready(function () {
            $(gradeAllButton).click(); //Click gradeAllButton (This will terminate this script)
            $(gradeAllButton).trigger("click"); //If that doesn't work
            document.location.href = $(gradeAllButton).attr("href");//If that doesn't work
        });
    }
}