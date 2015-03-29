click();

function click() {
    if (theAttemptNavController) {
        var next = document.getElementsByClassName('submit button-1')[0];
        if (next.tagName == "INPUT") {
            while (!theAttemptNavController) {
                setTimeout(function () {
                    console.log("Waiting for grading script to load...");
                }, 50);
            }
            next.onclick(); //Wont get here until theAttemptNavController exists
            //setTimeout(click(),500);
        }
    }
}