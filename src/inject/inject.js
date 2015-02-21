var port=chrome.runtime.connect({name: "MessageServer"});

main();

function main(){
    var page=detectPage();
    console.log(page);
    if(page==="gradingMenu")
        gradingMenu();
    else if(page==="gradeTest")
        gradeTest();
}
function detectPage(){ //Detects page
    if(document.title === "Needs Grading"){
        return "gradingMenu";
    }
    else if((document.title).indexOf("Grade Test: ")===0) { //Title starts with 'Grade Test: '
        return "gradeTest";
    }
    return null;

}
/*##########################
//## Needs Grading Screen ##
/#########################*/

function gradingMenu() {
    var gradeAllButton;
    findButton();
    setupEvent();
    setupMenu();
    //watchChange(gradeAllButton,setupMenu());

    function findButton(){
        gradeAllButton = $("#gradeAttemptButton");
        console.log($(gradeAllButton));
    }
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
        findButton();
        var onclick = "window.postMessage({ type: 'FROM_PAGE', text: 'Start_Grading' }, '*')"; //Call event from setupEvent() to get access to inject script.
        var disable="";
        if($(gradeAllButton).attr("class")==="disabled"){
            disable=" class=\"disabled\"";
            onclick="";
        }
        $('<li class="mainButton"><a id="autogradeButton"'+disable+' href="#" onclick="' + onclick + '")>Autograde All</a></li>').insertAfter(gradeAllButton.parent()); //Insert button after "Grade All" button
    }

    function receiveEvent(event) {
        if (event.data.text === "Start_Grading") {
            autograde();
        }
    }

    function autograde() { //Prepare background script for autograding
        console.log("Notifying background script we are starting grading.");
        message({status: "Starting_Grading"},function (response){
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
        document.location.href = $(gradeAllButton).attr("href");//Terminates Script
    }
}

/*########################
//## Grade Test Screen ##
#######################*/

function gradeTest(){
    message({prompt: "grading?"},function (response) {
        var grading=response.prompt;
        if(!grading){
            console.warn("Autograding Disabled");
            return;
        }
        var gradeInputs = [];
        var gradeTotals = [];
        var responses = [];
        $("input").each(function(index){
            if($(this).attr("type")==="text"&&$(this).attr("id").indexOf("points__")===0&&$(this).attr("name").indexOf("score-override-_")===0){ //Then we know its a answer field
                gradeInputs.push(this);
            }
        });
        for(var i=0;i<gradeInputs.length;i++){
            var label=$(gradeInputs).parent("label").text();
            label=label.substring(" out of ".length);
            label=label.substring(0,label.indexOf(" points "));
            gradeTotals.push(parseInt(label));
        }
        $(".vtbegenerated").each(function(index){
            if($(this).is("div")&&$(this).children().length>0){
                var children=$(this).children();
                var found=false;
                for(var i=0;i<children.length;i++) {
                    if ($(children.get(i)).is("p")) {
                        found = true;
                        break;
                    }
                }
                if(found) {
                    var parents = $(this).parentsUntil("tbody");
                    for (var i = 0; i < $(parents).length; i++) {
                        var child = $(parents.get(i)).children();
                        for(var x=0;x<$(parents).length;x++){
                            var child2=$(child.get(x)).children();
                            for(var z=0;z<$(child2).length;z++)
                            var child3=child2.get(z);
                            if ($(child3).is("span.label") && $(child3).text() === "Given Answer:") {
                                responses.push($($(this).children().get(x)).text());
                                break;
                            }
                        }

                    }
                }
            }
        });
        console.log("Found "+gradeInputs.length+" grades to fill.");
        console.log(gradeTotals);
        console.log(responses);

        grade(gradeInputs,gradeTotals,responses);
        nextTest();
    });

    function grade(inputs,totals,responses){
        for(var i=0;i<inputs.length;i++){
            var input=inputs[i];
            var total=totals[i];
            var response=responses[i];

            $(input).val(total);
        }
    }
    function nextTest(){
        var nextButton=$('input.submit.button-1');
        //if($(nextButton).attr("value")==="Submit"){ //We reached the last one
        //    message({status: "Finished_Grading"}, function(response){
        //        if(response.status === 200){
        //            var script = $(nextButton).attr("onclick");
        //            console.log("Following: "+script);
        //            //document.location.href=script;
        //            $(nextButton).onclick();
        //        }
        //        else{
        //            console.error("Error talking to background script: " + response.status);
        //        }
        //    });
        //}
        //$(nextButton).submit();
        $(nextButton).attr("onclick", "return true");
        nextButton.click();
        //$(nextButton).click();
        //var script = $(nextButton).attr("onclick");
        //console.log("Following: "+script);
        //script=script.substring("return ".length,script.length);
        //document.location.href="javascript: "+script;
         //Count tests graded?
    }

}

/*####################
//## Static Methods ##
################### */

function message(msg, response){
    port.postMessage(msg);
    port.onMessage.addListener(response);
}
function watchChange(node,callback){
    var MutationObserver    = window.MutationObserver || window.WebKitMutationObserver;
    var myObserver          = new MutationObserver (mutationHandler);
    var obsConfig           = { attributes: true };

//--- Add a target node to the observer. Can only add one node at a time.
    node.each ( function () {
        myObserver.observe (this, obsConfig);
    } );

    function mutationHandler (mutationRecords) {
        myObserver.disconnect();
        callback();
    }
}