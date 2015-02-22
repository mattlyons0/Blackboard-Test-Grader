//This script will run with direct access to the page (injected into it)

var i = setInterval(function ()
{
    if (window.theAttemptNavController)
    {
        clearInterval(i);
        var output=window.theAttemptNavController.saveAndNext(validateForm);
    }
}, 25);