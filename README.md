Blackboard Test Grader
======

### Disclaimer
This program was designed for use at Arizona State University and thus has only been tested on said Blackboard Shells. It will need to be modified and tested for whichever school it is used at. Modification instructions are listed below.

Additionally this is no longer maintained by me as the courses it supported have moved to a different grading platform. I am willing to help answer any questions about the codebase, open an issue and I'll get back to you as soon as possible!

### Purpose
- Automatically Grade Free Response Questions with a correct answer
  - Reduce need to hire graders based on number of students in class
  - Reduce professor workload
  - Allow class to convert into MOOC and scale near limitlessly

### Grading Method
- Stopwords are first removed in responses (based on [included stopword list](https://github.com/mattlyons0/Blackboard-Test-Grader/blob/master/js/stemmer.js#L187))
- Words are then stemmed using a implementation of [Porter's Stemmer](https://tartarus.org/martin/PorterStemmer/)
- Grades are assigned based on keyword matches
- *Note: This grading implementation is largely experimental and would need to be monitored heavily (and likely integrated with a synonym service) in order to be used in a real course*

### Usage
- Install extension
- Open whitelisted Blackboard Page URL (Default: myasucourses.asu.edu)
- Autograde All button will appear in Needs Grading page
- Click Autograde All to grade all currently visible assignments
- Optionally Enable Autograding can be toggled in Grade Center to only grade selected assignments
- After grading has completed a summary screen shall appear to show statistics and results from grading
- If scores are too low the 'correct' answer should be modified and assignments should be autograded again

### Modifying Source
- If for any reason you need to modify the source code it is organized as the following:
  - All the code that isn't a library is in `src/`
	- `src/bg` contains the script which runs in the background, this script is persistent to pageloads and is used to store information for grading sessions
	- `src/contentscripts` contains scripts which are injected into the webpage in a sandbox
		- `inject.js` is the script with the starting logic, it detects if it is a page we care about and forwards it to one of the following files. It also contains functions used by multiple files and the summary screen code.
		- `gradeCenter.js` is the logic for the toggle button in the grade center pages (full and test grade center)
		- `gradingMenu.js` is the logic for the "needs grading" page
		- `gradeTest.js` is the file that handles the logic for the actual grading pages and thus does the grading
	- `src/inject` contains files that are injected into the webpage directly (and are able to access the website directly, outside of the sandbox)
		- This is mainly useful for checking if scripts on the page have loaded and manipulating the page directly
		these scripts talk to the content scripts through events

- The element most likely to break in the future would be the code for determining what fields to use to pull grading information from. This is done in `gradeTest.js` using jQuery selectors.
