//This script will run with direct access to the page (injected into it)

var i = setInterval(function ()
{
    if (window.theAttemptNavController)
    {
        clearInterval(i);
        //console.log(validateForm);
        //var output=window.theAttemptNavController.saveAndNext(validateForm());
        //alert(output);
        window.theAttemptNavController.form.submit();
        if ( !window.theAttemptNavController.canILeaveThisPage(true))
        {
            console.log("1");
            return false;
        }
        if ( window.theAttemptNavController.disabledSaveAndNext )
        {
            console.log(2)
            return false; // prevent double click issues
        }
        if ( typeof(finalizeEditors) == "function" )
        {
            // make sure VTBE content is pushed into regular form inputs
            finalizeEditors();
        }
        if ( !window.theAttemptNavController.hasFormDataChanged() && !window.theAttemptNavController.isDraftGrade)
        {
            // LRN-50798 For attempts with NEEDS_GRADING status, skip the submit only
            // when there were no changes in the form and there was no grade saved as draft
            window.theAttemptNavController.viewNext();
            window.theAttemptNavController.disabledSaveAndNext = true;
            var origFormData = new Hash( window.theAttemptNavController.originalFormData );
            var currFormData = new Hash( window.theAttemptNavController.form.serialize(true) );
            var dataChanged = false;
            if ( window.theAttemptNavController.formElementsToIgnore )
            {
                window.theAttemptNavController.formElementsToIgnore.split(',').each( function(e){
                    origFormData.unset(e);
                    currFormData.unset(e);
                });
            }
            console.log(origFormData.toQueryString()+"\n"+currFormData.toQueryString());
            return false;
        }
        if ( validateForm && !validateForm() )
        {
            console.log(4)
            return false;
        }
        window.theAttemptNavController.clearOriginalFormData();
        window.theAttemptNavController.disabledSaveAndNext = true;
        window.theAttemptNavController.form.cancelGradeUrl.value = window.theAttemptNavController.nextGradingUrl;
        window.theAttemptNavController.form.submit();
        console.log(5);
        return false;
    }
}, 1000);