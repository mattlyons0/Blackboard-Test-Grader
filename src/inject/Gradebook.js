var theGradeCenter;
var GradebookGridUtil;
var SelectCtrl;

// GradeCenter -----------------------------------------------------
var GradeCenter = Class.create();
GradeCenter.prototype =
{

	initialize : function()
	{
		this.log4j = null;
		this.statusTextTemplate = new Template(page.bundle.getString('statusTextMsg'));
		this.columnStatusTextTemplate = new Template(page.bundle.getString('columnStatusTextMsg'));
		this.calcColumnStatusTextTemplate = new Template(page.bundle.getString('calcColumnStatusTextMsg'));
		this.lastViewportSize = document.viewport.getDimensions();
		this.PageTitle = $('pageTitleText');
		this.basePageTitle = this.PageTitle.innerHTML;
		Event.observe(window, 'resize', this.onWindowResize.bindAsEventListener(this));
		Event.observe(window, 'unload', this.onWindowUnload.bindAsEventListener(this));
		Event.observe('iconLegendLink2', 'click', this.showIconLegendUp.bindAsEventListener(this));
		Event.observe('closeCommentsLink', 'click',this.closeComments.bindAsEventListener(this));
		Event.observe('setAsDefaultLink', 'click',this._onSetAsDefault.bindAsEventListener(this));
		Event.observe('restoreFromSingleStudentView', 'click', this.restoreFromSingleStudentView.bindAsEventListener(this));
		Event.observe('sortSelectedTop', 'click',this.sortSelected.bindAsEventListener(this));
		Event.observe('sortSelected', 'click',this.sortSelected.bindAsEventListener(this));
		if ( window.sessionAccessibleMode != 'true' )
		{
			Event.observe('openRowEditing', 'click',this.openRowsEditPanel.bindAsEventListener(this));
		}
		Event.observe('closeRowEditing', 'click',this.closeRowsEditPanel.bindAsEventListener(this));
		Event.observe('submitRowEditing', 'click',this.submitVisibleRows.bindAsEventListener(this));
		Event.observe('numRows', 'keydown',this.submitRowsByEnter.bindAsEventListener(this));
		Event.observe('close_infodiv', 'click',this.hideMenu.bindAsEventListener(this));
//    Event.observe('findButton', 'click',this.onFindRow.bindAsEventListener(this));
		this.hookPageToggleListeners.bind( this ).defer( ); //hook after all scripts are loaded and init

		// the resize element utility does not detach event handlers when the page
		// is unloaded,
		// so use prototype.js Event.observe instead. Conveniently they have the
		// same signature.
		Form.Element.Resize.prototype._addEvent = Event.observe;
		this.instructorCommentsResize = new Form.Element.Resize(
			{
				elementId :'instructorComments',
				containerClass :'resizeCommentsTable',
				resizeType :
				{
					s :1,
					e :1,
					se :1
				}
			});
		this.studentCommentsResize = new Form.Element.Resize(
			{
				elementId :'studentComments',
				containerClass :'resizeCommentsTable',
				resizeType :
				{
					s :1,
					e :1,
					se :1
				}
			});

		page.ContextMenu.addDivs(); // needs to be done so menu items are present when creating template
		// create a template for use in creating context menus
		var cmc = $( 'contextMenuContainer' );
		this.contextMenuTemplate = cmc.down( 'span.contextMenuContainer' ).cloneNode( true );
		var cma = this.contextMenuTemplate.down( "a" );
		// remove onfocus/onmouseover handlers from anchor in template
		cma.removeAttribute( "onfocus" );
		cma.removeAttribute( "onmouseover" );
		cmc.remove();
		page.ContextMenu.removeDivs();

		this.viewSelect = new SelectCtrl( 'viewList', this._onSelectView.bindAsEventListener(this), 'currentViewLabel' );
		this.sortColSelect = new SelectCtrl( 'sortByList', this._onSelectSortCol.bindAsEventListener(this), 'sortItemsByLabel' );
		this.categorySelect = new SelectCtrl( 'categoryList', this._onSelectCategory.bindAsEventListener(this), 'categoryLabel' );
		this.sortDirSelect = new SelectCtrl( 'sortDirList', this._onSelectSortDir.bindAsEventListener(this), 'sortDirectionLabel' );
		this.statusSelect = new SelectCtrl( 'statusList', this._onSelectStatus.bindAsEventListener(this), 'statusLabel' );
		var view = '';
		if (window.customViewIdParam)
		{
			if (window.customViewIdParam != 'fullGC')
			{
				window.customViewIdParam = 'cv_' + window.customViewIdParam;
			}
			view = window.customViewIdParam;
		}
		this._initializeGrid( view );
		this.setCourseHasGoals();
	},

	setCourseHasGoals : function()
	{
		var crsId = window.model.courseId;
		if (crsId.indexOf("_") >= 0)
		{
			crsId = crsId.split("_")[1];
		}
		GradebookDWRFacade.courseHasGoals( crsId, function( hasGoals )
		{
			GradeCenter.courseHasGoals = hasGoals;
		});
	},

	hookPageToggleListeners: function()
	{
		if (page && page.PageMenuToggler && page.PageMenuToggler.toggler)
		{
			page.PageMenuToggler.toggler.addToggleListener(this.resizeGrid.bindAsEventListener(this));
		}
		if (page && page.PageHelpToggler && page.PageHelpToggler.toggler)
		{
			page.PageHelpToggler.toggler.addToggleListener(this.resizeGrid.bindAsEventListener(this));
		}
	},

	_initializeGrid : function(view)
	{
		if ( this.grid && !this.grid.loaded )
		{
			return;
		}
		Event.observe('content', 'click', this._swallowEvent ); //no click on grade center button until grade center data loaded
		$('loadstatus').style.display="block";
		Gradebook.Grid.pageHeightOffset = $( 'breadcrumbs' ).offsetHeight;
		Gradebook.CellController.prototype.closePopups(null);
		var s = this.getAvailableGridSize();
		var tableWidth = s.w;
		var tableHeight = s.h;
		var gradebookService = new Gradebook.GridService(window.courseID);
		if (window.parent == window)
		{
			alert(window.gridMessages.singleWindowErrorMsg);
		}
		if (!window.model || window.model.courseId != window.courseID)
		{
			// model is loaded on the JSP script
			var parWin = parent;
			if (!parWin.Gradebook)
			{
				parWin = parent.parent;
			}
			window.model = new parWin.Gradebook.GridModel(gradebookService);
			window.model.accessibleMode = (window.sessionAccessibleMode == 'true');
		}
		window.model.gridImages = window.gridImages;
		window.model.setFloatLocaleFormat( GradebookUtil.getFloatLocaleFormatFromWindow() );
		if (window.accessibleModeParam)
		{
			window.model.setAccessibleMode(window.accessibleModeParam == 'true');
		}
		this.initModeDependentScreenText(); // now that we know the accessible mode

		window.model.setInitialCurrentView(view);

		var _gridOptions =
		{
			accessibleMode : window.model.getAccessibleMode(),
			tableWidth: tableWidth,
			tableHeight: tableHeight,
			onLoadComplete: this.doneLoading.bind(this),
			sendEmailFunc: this.sendEmail.bind(this),
			sortBlankImg: '/images/swatches/blank.gif',
			topArrowLImg: '/images/ci/misc/toparrowL.gif',
			topArrowRImg: '/images/ci/misc/toparrowR.gif',
			botArrowLImg: '/images/ci/misc/botarrowL.gif',
			botArrowRImg: '/images/ci/misc/botarrowR.gif',
			gradeHistoryEnabled: window.gradeHistoryEnabled
		};

		var tableId = 'table1';
		this.tblDivId = 'nonAccessibleTableDiv';
		if (window.model.getAccessibleMode())
		{
			tableId = 'table1_accessible';
			this.tblDivId = 'accessibleTableDiv';
			if ($('nonAccessibleTableDiv'))
			{
				Element.remove( 'nonAccessibleTableDiv' );
			}
		}
		else
		{
			if ($('accessibleTableDiv'))
			{
				Element.remove( 'accessibleTableDiv' );
			}
		}
		this.origTableDivNode = $(this.tblDivId).cloneNode(true);
		this.grid = new Gradebook.Grid(tableId, gradebookService, _gridOptions, window.model);
	},

	doneLoading : function()
	{
		$('loadstatus').style.display="none";
		if (window.model.getAccessibleMode())
		{
			$('accessibleTableDiv').className="";
			$('accessibleTableDiv').style.display="block";
		}
		else
		{
			$('nonAccessibleTableDiv').className="";
		}
		$('cellInfo').className = $('cellInfo').className.replace('offscreen', '');
		$('selectedRows').removeClassName('offscreen');
		window.model.setResizingWindow(false);

		var tableWidth = window.model.getAccessibleMode() ? $('table1_accessible_container').offsetWidth : $('table1_header').offsetWidth;
		$( 'tableBarTop' ).style.width = tableWidth - 34; // compensate for padding on rumble_top/rumble CSS class
		$( 'tableBarBottom' ).style.width = tableWidth - 34;
		this._setMaxHeightForViewSelect();
		Event.stopObserving('content', 'click', this._swallowEvent ); //no click on grade center button until grade center data loaded
		if (window.model.isolatedStudentId)
		{
			$('restoreFromSingleStudentView').show();
		}
		else
		{
			$('restoreFromSingleStudentView').hide();
		}

		this.viewSelect.select(window.model.currentView);
		this._updateDefaultAndCurrentViewIndicators();
		this.sortColSelect.select(window.model.currentSortColumnBy ? window.model.currentSortColumnBy : 'pos');
		this.sortDirSelect.select(window.model.currentSortDir ? window.model.currentSortDir : 'asc');
		this.categorySelect.select(window.model.getCurrentCategory());
		this.statusSelect.select('stat_' + window.model.getCurrentStatus());
		var isStatusView = window.model.isStatusView();
		this.statusSelect.setEnable( isStatusView );
		this.categorySelect.setEnable( isStatusView );

		if ( turnOnGridColor )
		{
			$('containerdiv').addClassName( "colorschemeon" );
		}
		this.PageTitle.update(this.basePageTitle + ': ' + window.model.getCurrentViewName());
		this.setTaskBarTextMaxSize( );

		// focus the correct cell if it is available
		var focusCell = $( window.focusCellId );
		if ( focusCell )
		{
			focusCell.addClassName( 'cellClick' );
			if ( window.model.getAccessibleMode() )
			{
				focusCell.down( 'a' ).focus();
			}
			else
			{
				// set focus on context menu for non-accessible mode
				focusCell.controller.insertContextMenu();
				focusCell.down( 'a.cmimg' ).focus();
			}
		}

	},

	reloadGrid : function()
	{
		if (!this.grid.loaded)
		{
			return;
		}
		this.grid.unload();
		var tdiv = $( this.tblDivId );
		tdiv.parentNode.replaceChild( this.origTableDivNode, tdiv );
		$('selectedRows').addClassName('offscreen');
		$('cellInfo').addClassName('offscreen');
		this._initializeGrid();
	},

	_onSelectView : function(view)
	{
		window.model.setCurrentView(view);
		this.reloadGrid();
	},

	_onSelectSortCol : function(sortCol)
	{
		window.model.sortColumns(sortCol);
		window.model.fireModelChanged();
	},

	_onSelectSortDir : function(sortDir)
	{
		window.model.sortColumns(window.model.currentSortColumnBy);
		window.model.fireModelChanged();
	},

	_onSelectCategory : function(category)
	{
		window.model.setCategoryFilter(category);
		this.reloadGrid();
	},

	_onSelectStatus : function(status)
	{
		window.model.setStatusFilter(status);
		this.reloadGrid();
	},

	onFindRow : function()
	{
//  findRow: function( textToFind, rowIncrement, startingRowIndex )
		var loc = window.model.findText( $('findText').value );
		if ( loc != null )
		{
			this.grid.viewPort.selectCell( loc );
		}
	},

	_onSetAsDefault : function()
	{
		window.model.setDefaultView(window.model.currentView);
	},

	_updateDefaultAndCurrentViewIndicators: function()
	{
		var defView = window.model.getDefaultView();
		var curView = window.model.currentView;

		$A(this.viewSelect.list.getElementsByTagName("li")).each(function(li)
		{
			var anchor = li.down('a');
			if (!anchor)
			{
				return;
			}
			anchor.down('span.defaultMessage').update( (li.id == defView) ? page.bundle.getString("defaultParensMsg") : '' );
			anchor.down('span.currentMessage').update( (li.id == curView) ? page.bundle.getString("currentSelectionMsg") : '' );
		});
	},

	_setMaxHeightForViewSelect: function()
	{
		var topOffset = $('currentViewLabel').viewportOffset().top;
		var availableHeight = document.viewport.getHeight() - topOffset - 20;
		if ( availableHeight < 180 )
		{
			availableHeight = 180;
		}
		var viewListElement = $('viewList');
		viewListElement.style.overflow = '';
		viewListElement.style.maxHeight='';
		if ( availableHeight < $('viewList').offsetHeight )
		{
			viewListElement.style.maxHeight= availableHeight + 'px';
			viewListElement.style.overflow = 'auto';
		}
	},

	sendEmailToSelected : function(type)
	{
		var selectedStudentIds = window.model.getCheckedStudentIds();
		if (selectedStudentIds.length === 0 && type != 'T')
		{
			alert( GradebookUtil.getMessage('noStudentsSelectedMsg') );
			return;
		}
		this.sendEmail(type,selectedStudentIds);
	},

	sendEmail : function(type, studentIds)
	{
		var frm = document.composeEmailForm;
		frm.type.value = type;
		var selElement = frm.selectedStatus;
		selElement.value = studentIds[0];
		for ( var i = 1; i < studentIds.length; i++)
		{
			var newElement = selElement.cloneNode(false);
			newElement.value = studentIds[i];
			frm.appendChild(newElement);
		}
		frm.submit();
	},

	setTaskBar : function(gradeType, pointsPossible, primaryDisplay, visibileToStudents)
	{
		var currentStatusString = $("statusdata").innerHTML;
		if (!gradeType)
		{
			var msg = GradebookUtil.getMessage( 'notGradeCol');
			if (currentStatusString != msg)
			{
				$("statusdata").update(msg); // avoid unnecessary updates since this is an aria-live region
			}
		}
		else
		{
			var dataTemp =
			{
				pdisplay : primaryDisplay,
				gtype : gradeType,
				ppossible : pointsPossible,
				vstudents : visibileToStudents
			};
			var infoString= this.statusTextTemplate.evaluate(dataTemp);
			if (currentStatusString != infoString)
			{
				$("statusdata").update(infoString);
			}
		}
	},

	clearTaskBar : function()
	{
		$("statusdata").update("");
	},

	setHeaderInfoInTaskBar : function( colDef )
	{
		var category = colDef.getCategory( )? ( '| ' + colDef.getCategory( ) ): '';
		var gradingPeriod = colDef.getGradingPeriod( )? ( '| ' + colDef.getGradingPeriod( ) ): '';
		var dataTemp =
		{
			name : colDef.getName( ),
			gtype : GradebookUtil.getMessage( colDef.getType() + 'Msg' ),
			ppossible : colDef.getPointsForDisplay(),
			category: category,
			gradingperiod: gradingPeriod
		};
		var template = colDef.isCalculated( )?this.calcColumnStatusTextTemplate:this.columnStatusTextTemplate;
		var msg = template.evaluate(dataTemp);
		if ($("statusdata").innerHTML != msg)
		{
			$("statusdata").update(msg);
		}
	},

	setMsgInTaskBar : function(msg)
	{
		if ($("statusdata").innerHTML != msg)
		{
			$("statusdata").update(msg);
		}
	},

	setTaskBarTextMaxSize : function ( )
	{
		var width = $( 'cellInfo' ).offsetWidth - 20 ;
		width = width - $( 'statusTitle' ).offsetWidth;
		width = width - $( 'timeStampDiv' ).offsetWidth;
		if (width > 0) // TODO: Why does this go negative?  causes errors in IE
		{
			$( 'statusdata' ).style.maxWidth =  ( width + 'px' );
		}
		$( 'statusdata' ).style.maxHeight = ( ( $( 'cellInfo' ).offsetHeight - 4 /*2padding top/bottom*/ ) + 'px' );
	},

	onWindowUnload : function(evt)
	{
		this.origTableDivNode = null;
		this.grid.unload();
	},

	onWindowResize : function(evt)
	{
		// resizingWindow flag tells us we're already doing a resize
		// multiple resize events will be fired if user drags the window edge/corner
		// we only want to resize once
		if (!model || model.getResizingWindow() || Gradebook.noResize || Gradebook.alertLightbox || !this.grid || !this.grid.loaded )
		{
			return;
		}
		this.setTaskBarTextMaxSize( );
		var newViewportSize = document.viewport.getDimensions();
		if ( this.lastViewportSize )
		{
			var delta = (Math.abs( this.lastViewportSize.width - newViewportSize.width  ) + Math.abs ( this.lastViewportSize.height - newViewportSize.height ));
			if (delta < 80)
			{
				return;
			}
		}
		this.lastViewportSize = newViewportSize;
		this.resizeGrid();
	},

	showIconLegendUp : function(event)
	{
		var object = Event.element( event );
		Event.stop( event ); // swallow event
		var parentObj = object.up();
		var parentPosition = Element.positionedOffset( parentObj );
		var theMenu = $('icondiv_up');
		theMenu.style.display = "block";
		if( page.util.isRTL() )
		{
			theMenu.style.left = parentPosition[0] + "px";
		}
		else
		{
			theMenu.style.left = parentObj.offsetLeft-theMenu.offsetWidth+80 + "px";
		}
		var topOffset = parentPosition[1]-theMenu.offsetHeight+2;
		theMenu.style.top = topOffset+"px";
		return false;
	},

	getAvailableGridSize : function()
	{
		var ie = document.all && navigator.userAgent.indexOf("Opera") == -1;
		var containerdiv = $('containerdiv');
		var w = containerdiv.offsetWidth;
		w -= 50;
		var h = (ie ? document.body.clientHeight : window.innerHeight);
		h -= $('tableBarTop').cumulativeOffset().top;
		h -= $('tableBarTop').offsetHeight;
		h -= $('tableBarBottom').offsetHeight;
		h -= $('cellInfo').offsetHeight;
		h -= $('editRows').offsetHeight;
		h -= 75;
		if (h < 50)
		{
			h = 50;
		}
		return { w:w, h:h };
	},

	resizeGrid: function()
	{
		window.model.setResizingWindow(true);

		// closes menus & prompts to save edits
		Gradebook.CellController.prototype.closePopupsAndRestoreFocus();

		if (window.model.getAccessibleMode())
		{
			var s = this.getAvailableGridSize();
			this.grid.options.tableWidth = s.w;
			this.grid.options.tableHeight = s.h;
			this.grid.setAccessibleViewportSize( );
			// clear the resizing flag
			window.model.setResizingWindow(false);
		}
		else
		{
			// reload grid, recomputing its size so we don't get double scroll bars (for the grid & the page)
			// the resizing flag will get cleared in the doneLoading function after the grid is reloaded
			this.reloadGrid();
		}
	},

	restoreFromSingleStudentView : function(evt)
	{
		if (evt)
		{
			Event.stop( evt );
		}
		window.model.restoreFromSingleStudentView();
	},

	hideMenu : function(evt)
	{
		if (evt)
		{
			Event.stop( evt );
		}
		Gradebook.CellController.prototype.closePopups();
	},

	closeComments : function(evt)
	{
		if (evt)
		{
			Event.stop( evt );
		}
		Gradebook.CellController.prototype.closeComments();
	},

	openRowsEditPanel : function(event)
	{
		$('numRows').value = window.model.getMinimumRows();
		$('editRowsPanel').show();
		$('viewEditRowsButton').hide();
		if (event)
		{
			Event.stop( event );
		}
		return false;
	},

	closeRowsEditPanel : function(event)
	{
		$('editRowsPanel').hide();
		$('viewEditRowsButton').show();
		if (event)
		{
			Event.stop( event );
		}
	},
	submitRowsByEnter : function( event )
	{
		if (event.keyCode == Event.KEY_RETURN){
			this.submitVisibleRows(event);
			return false;
		}
	},
	submitVisibleRows : function(event)
	{
		var trimmedVal = $('numRows').value.trim();
		if ( trimmedVal!="" )
		{
			var numVal = parseInt(trimmedVal, 10);
			if( !isNaN(numVal) )
			{
				if (numVal != window.model.getMinimumRows())
				{
					window.model.setMinimumRows(numVal);
					if (!window.model.getAccessibleMode())
					{
						this.resizeGrid() ;
					}
					else
					{
						this.grid.setAccessibleViewportSize();
					}
				}
			}
		}
		this.closeRowsEditPanel( event );
	},

	sortSelected : function(event)
	{
		if (!this.grid.checkAllCellController)
		{
			return;
		}
		this.grid.checkAllCellController.onSortCheckedStudents( event );
	},

	initModeDependentScreenText : function()
	{
		page.ContextMenu.addDivs();
		var menuItemSpan;
		if (window.model.getAccessibleMode())
		{
			document.title = window.gridMessages.pageTitleBasicView;
			menuItemSpan = $('accessible_menu_item');
			menuItemSpan.innerHTML = window.gridMessages.ctxMenuSwitchToStandard;
			menuItemSpan.up('A').href = window.viewSpreadsheetURLStandard;
		}
		else
		{
			menuItemSpan = $('accessible_menu_item');
			menuItemSpan.innerHTML = window.gridMessages.ctxMenuSwitchToAccessible;
			menuItemSpan.up('A').href = window.viewSpreadsheetURLAccessible;
		}
		page.ContextMenu.removeDivs();
	},

	toggleColorScheme: function( )
	{
		var containerDiv = $('containerdiv');
		containerDiv.toggleClassName( "colorschemeon" );
		var isSchemeOn = containerDiv.hasClassName( "colorschemeon" );
		$('colorSchemeButton').innerHTML = isSchemeOn ? window.gridMessages.hideColorSchemeMsg : window.gridMessages.showColorSchemeMsg;
		var key = 'crs' + window.courseID + 'gradebook.colorschemeon'; // need to be revisited when course scoped settings avail; see ViewSpreadsheet2Action
		UserDataDWRFacade.setStringPermScope( key, isSchemeOn?'true':'false' );
	},

	beforeContextMenuShown : function( cm )
	{
		if ( cm.cellController )
		{
			cm.cellController.closePopups( );
			cm.setItems( cm.cellController.getContextMenuItems() );
		}
	},

	_swallowEvent : function(event)
	{
		if ( event )
		{
			Event.stop(event);
		}
	}

};

// SelectCtrl -----------------------------------------------------
SelectCtrl = Class.create();
SelectCtrl.prototype =
{

	initialize : function(listId, extOnSelFunc, curVal)
	{
		this.list = $(listId);
		this.extOnSelFunc = extOnSelFunc;
		this.curVal = $(curVal);
		this.invokeLink = this.list.up('li').down('a');
		this.flyoutMenu = this.invokeLink.flyoutMenu;
		$A(this.list.getElementsByTagName("li")).each( function( li ){
			if (li.id.endsWith('_1'))
			{
				li.id = li.id.substr(0,li.id.length-2);
			}
			var anchor = $(li).down('a');
			if (anchor)
			{
				Event.observe(anchor,'click',this._onSelect.bindAsEventListener(this,li));
			}
		}.bind(this) );
	},
	setEnable: function( enable ) {
		if (enable)
		{
			this.invokeLink.removeClassName('disabled');
		}
		else
		{
			this.invokeLink.addClassName('disabled');
		}
		this.flyoutMenu.setEnabled( enable );
	},

	select : function(id)
	{
		$A(this.list.getElementsByTagName("li")).each(function(li)
		{
			if (id == li.id)
			{
				return this._onSelect(null, $(li));
			}
		}.bind(this) );
	},
	_onSelect : function(event, sel_li)
	{
		if (event && this.extOnSelFunc)
		{
			this.extOnSelFunc(sel_li.id);
		}
		$A(this.list.getElementsByTagName("li")).each(function(li)
		{
			li.removeClassName('current');
		});
		sel_li.addClassName('current');
		this.curVal.update(sel_li.down('a').innerHTML);
		if (event)
		{
			this.flyoutMenu.close();
			(function() { this.invokeLink.focus(); }.bind(this).defer());
			Event.stop( event );
		}
	}
};

function beforeContextMenuShown( cm )
{
	theGradeCenter.beforeContextMenuShown( cm );
	cm.keepMenuToRight = true;
}

FastInit.addOnLoad( function()
{
	theGradeCenter = new GradeCenter();
});
// Gradebook is grade center namespace
var Gradebook =
{
	getModel: function()
	{
		try
		{
			if (window.gbModel)
			{
				return window.gbModel; // in case scope is GC/Course Frameset
			}
			if (parent.gbModel)
			{
				return parent.gbModel;
			}
			return parent.parent.gbModel;
		}
		catch (ignore)
		{
			return null;
		}
	},

	clearModel: function()
	{
		parent.gbModel = null;
	}
};

var GradebookUtil =
{

	parseLocaleFloat : function( num )
	{
		// substitute for later calls to not have to Gradebook.getModel().getNumberFormatter()
		GradebookUtil.parseLocaleFloat = Gradebook.getModel().getNumberFormatter().parseLocaleFloat;
		return GradebookUtil.parseLocaleFloat( num );
	},

	toLocaleFloat : function( num )
	{
		GradebookUtil.toLocaleFloat = Gradebook.getModel().getNumberFormatter().getDisplayFloat;
		return GradebookUtil.toLocaleFloat( num );
	},

	round: function( num )
	{
		return Math.round( num * 100) / 100;
	},

	error : function( errorMsg )
	{
		// firebug/IE console
		if ( console && console.error )
		{
			console.error( errorMsg );
		}
	},

	log : function( logMsg )
	{
		// firebug/IE console
		if ( console && console.log )
		{
			console.log( logMsg );
		}
	},

	isIE: function ()
	{
		return navigator.userAgent.toLowerCase().indexOf("msie") >= 0;
	},

	isFFonMac: function()
	{
		return GradebookUtil.isMac() && GradebookUtil.isFirefox();
	},

	isFirefox: function()
	{
		return (navigator.userAgent.toLowerCase().indexOf("firefox") != -1);
	},

	isMac: function()
	{
		return (navigator.userAgent.toLowerCase().indexOf("mac") != -1);
	},

	getFloatLocaleFormatFromWindow: function()
	{
		var localeFloatFormat = { separator:'.', format:'' };
		if ( window.LOCALE_SETTINGS )
		{
			if ( LOCALE_SETTINGS.getString('number_format.decimal_point') )
			{
				localeFloatFormat.separator = LOCALE_SETTINGS.getString('number_format.decimal_point');
			}
			if ( LOCALE_SETTINGS.getString('float.allow.negative.format') )
			{
				localeFloatFormat.format = LOCALE_SETTINGS.getString( 'float.allow.negative.format' );
			}
		}
		else
		{
			var separator = page.bundle.getString('number_format.decimal_point');
			if ( separator )
			{
				localeFloatFormat.separator = separator;
			}
		}
		if ( !localeFloatFormat.format )
		{
			// for some reason the current locale does not define the format, so let's build one
			if ( localeFloatFormat.separator === ',' )
			{
				localeFloatFormat.format = '^[-]?[0-9]*(,[0-9]+)?$';
			}
			else
			{
				localeFloatFormat.format = '^[-]?[0-9]*(\\.[0-9]+)?$';
			}
		}
		return localeFloatFormat;
	},

	isValidFloat: function ( n )
	{
		if ( n instanceof Number || typeof( n ) == 'number' )
		{
			return true;
		}
		n = '' + n;
		var trimmedVal = n.strip();
		var floatLocaleFormat = null;
		var model = Gradebook.getModel();
		if ( model && model.getFloatLocaleFormat()  )
		{
			floatLocaleFormat = model.getFloatLocaleFormat();
		}
		else
		{
			// those settings would be the settings of the page where the javascript code
			// is executed, which might not be in the same locale as the course itself
			floatLocaleFormat = this.getFloatLocaleFormatFromWindow();
		}
		if (trimmedVal.endsWith( floatLocaleFormat.separator ))
		{
			trimmedVal += '0';
		}
		var re = new RegExp( floatLocaleFormat.format );
		var isValidNum = trimmedVal.search( re ) === 0;
		return isValidNum;
	},

	isGradeValueTooBig: function ( inputValue )
	{
		return inputValue >= 10000000000;
	},

	formatStudentName: function ( student )
	{
		var nameData = {first:student.first, last:student.last, user:student.user};
		return GradebookUtil.getMessage('userNameTemplate', nameData);
	},

	trimId: function( primaryKey )
	{
		if ( primaryKey.charAt(0) != '_' )
		{
			return primaryKey;
		}
		return primaryKey.slice(1, primaryKey.lastIndexOf('_') );
	},

	getMessage: function (key, args) {
		if ( Gradebook.getModel() ) {
			return Gradebook.getModel().getMessage(key, args);
		} else {
			return key;
		}
	},

	getElementsComputedStyle: function ( htmlElement, cssProperty, mozillaEquivalentCSS)
	{
		if ( arguments.length == 2 )
		{
			mozillaEquivalentCSS = cssProperty;
		}

		var el = $(htmlElement);
		if ( el.currentStyle )
		{
			return el.currentStyle[cssProperty];
		}
		else
		{
			return document.defaultView.getComputedStyle(el, null).getPropertyValue(mozillaEquivalentCSS);
		}
	},

	toViewportPosition: function(element)
	{
		return this._toAbsolute(element,true);
	},

	/**
	 *  Compute the elements position in terms of the window viewport
	 *  so that it can be compared to the position of the mouse (dnd)
	 *  This is additions of all the offsetTop,offsetLeft values up the
	 *  offsetParent hierarchy, ...taking into account any scrollTop,
	 *  scrollLeft values along the way...
	 *
	 *  Note: initially there was 2 implementations, one for IE, one for others.
	 *  Mozilla one seems to fit all though (tested XP: FF2,IE7, OSX: FF2, SAFARI)
	 **/
	_toAbsolute: function(element,accountForDocScroll, topParent )
	{
		return this._toAbsoluteMozilla(element,accountForDocScroll,topParent);
	},

	/**
	 *  Mozilla did not report all of the parents up the hierarchy via the
	 *  offsetParent property that IE did.  So for the calculation of the
	 *  offsets we use the offsetParent property, but for the calculation of
	 *  the scrollTop/scrollLeft adjustments we navigate up via the parentNode
	 *  property instead so as to get the scroll offsets...
	 *
	 **/
	_toAbsoluteMozilla: function(element,accountForDocScroll, topParent)
	{
		// possibly should be replaced by prototype viewportOffset
		var x = 0;
		var y = 0;
		var parent = element;
		while ( parent && ( !topParent || parent!=topParent ) )
		{
			x += parent.offsetLeft;
			y += parent.offsetTop;
			parent = parent.offsetParent;
		}

		parent = element;
		while ( parent &&
		parent != document.body &&
		parent != document.documentElement &&
		( !topParent || parent!=topParent ) )
		{
			if ( parent.scrollLeft  )
			{
				x -= parent.scrollLeft;
			}
			if ( parent.scrollTop )
			{
				y -= parent.scrollTop;
			}
			parent = parent.parentNode;
		}

		if ( accountForDocScroll )
		{
			x -= this.docScrollLeft();
			y -= this.docScrollTop();
		}

		return { x:x, y:y };
	},

	docScrollLeft: function() {
		if ( window.pageXOffset )
		{
			return window.pageXOffset;
		}
		else if ( document.documentElement && document.documentElement.scrollLeft )
		{
			return document.documentElement.scrollLeft;
		}
		else if ( document.body )
		{
			return document.body.scrollLeft;
		}
		else
		{
			return 0;
		}
	},

	docScrollTop: function()
	{
		if ( window.pageYOffset )
		{
			return window.pageYOffset;
		}
		else if ( document.documentElement && document.documentElement.scrollTop )
		{
			return document.documentElement.scrollTop;
		}
		else if ( document.body )
		{
			return document.body.scrollTop;
		}
		else
		{
			return 0;
		}
	},

	getChildElementByClassName: function(parent, childTag, childClassName)
	{
		var children = parent.getElementsByTagName(childTag);
		if (!children || children.length === 0)
		{
			return null;
		}
		for (var i = 0; i < children.length; i++)
		{
			if (children[i].className.indexOf(childClassName) >= 0)
			{
				return children[i];
			}
		}
		return null;
	},

	// returns true if the text area length is less than maxLength.
	// text area length is greater than maxLength, alerts user, sets focus to text area and returns false
	validateMaxLength : function( textArea, label, maxlength )
	{
		var textLength = textArea.value.length;
		if ( maxlength < textLength )
		{
			if ( (textLength - maxlength) > 1 )
			{
				alert(JS_RESOURCES.getFormattedString('validation.maximum_length.plural', [label, maxlength, textLength - maxlength] ));
			}
			else
			{
				alert(JS_RESOURCES.getFormattedString('validation.maximum_length.singular', [label, maxlength] ));
			}
			textArea.focus();
			return false;
		}
		else
		{
			return true;
		}
	}

};


/**
 *  Gradebook data grid
 *
 *  PORTIONS OF THIS FILE ARE BASED ON RICO LIVEGRID 1.1.2
 *
 *  Copyright 2005 Sabre Airline Solutions
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this
 *  file except in compliance with the License. You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software distributed under the
 *  License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
 *  either express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 *
 * File:
 * Authors(s): Bill Richard
 * Description: Main controller class for gradebook2 grid.
 * Version:
 **/

var GradebookGridUtil =
{
	// WARNING: do not call the showInlineReceipt function until any previous requests have completed
	// because it will reload the page and may cause the previous request to terminate prematurely
	// Might also want to add a Show Inline Method that does not require a reload
	reloadAndShowInlineReceipt : function(message)
	{
		window.location.href = window.viewSpreadsheetURL + '&inline_receipt_message=' + message;
	},

	showAlertLightbox : function( flyoutFormId, title, firstElement )
	{
		var lightboxParam =
		{
			dimensions :
			{
				w : 600,
				h : 150
			},
			title : title,
			closeOnBodyClick : false,
			showCloseLink : false,
			contents :
			{
				id : flyoutFormId,
				move : true
			}
		};
		Gradebook.alertLightbox = new lightbox.Lightbox( lightboxParam );
		var submitButton = $( flyoutFormId + 'Submit');
		var firstElement = $( firstElement );
		Gradebook.alertLightbox.open(function()
		{
			firstElement.focus();
			Gradebook.alertLightbox.lastLink = submitButton;
			Gradebook.alertLightbox.firstLink = firstElement;
		});
		GradebookGridUtil.resizeLightbox( flyoutFormId );
	},

	resizeLightbox : function( content )
	{
		var newHeight = $( content ).getHeight( ) + 60;
		if ( newHeight > 150 )
		{
			Gradebook.alertLightbox.resize( {w:600, h:newHeight } );
		}
	},

	//on firefox/mac scroll bars will show ontop of anything if not shimmed
	shimDiv : function(menuDiv)
	{
		var shimIFrame = $('shimDiv');
		if (!shimIFrame)
		{
			return;
		}
		shimIFrame.style.width = menuDiv.offsetWidth;
		shimIFrame.style.height = menuDiv.offsetHeight;
		var position = Position.page(menuDiv);
		shimIFrame.style.top = position[1];
		shimIFrame.style.left = position[0];
		shimIFrame.style.zIndex = 2;
		shimIFrame.style.display = "block";
	},

	clearShim : function()
	{
		if ($("shimDiv"))
		{
			$("shimDiv").style.display = "none";
		}
	}
};

var GradebookScrollContext = Class.create(
	{
		initialize: function( accessibleMode, currentView )
		{
			this.accessibleMode = accessibleMode;
			this.currentView = currentView;

			if ( this.accessibleMode )
			{
				this.accessibleScrollSettings = {};
			}
			else
			{
				this.inaccessibleScrollSettings = {};
			}
		},

		saveScrollCoordinates: function()
		{
			if ( this.accessibleMode )
			{
				this.saveScreenReaderModeScrollCoordinates();
			} else
			{
				this.saveInteractiveModeScrollCoordinates(theGradeCenter.grid.viewPort);
			}
		},

		saveScreenReaderModeScrollCoordinates: function()
		{
			var container = document.getElementById('table1_accessible_container');
			this.accessibleScrollSettings.y = container.scrollTop;
			this.accessibleScrollSettings.x = container.scrollLeft;
		},

		saveInteractiveModeScrollCoordinates: function(viewPort)
		{
			if ( !viewPort )
			{
				return;
			}
			if ( viewPort.scrollerDiv )
			{
				this.inaccessibleScrollSettings.scrollTop = viewPort.scrollerDiv.scrollTop;
			}
			if ( viewPort.scrollerDivH )
			{
				this.inaccessibleScrollSettings.scrollLeft = viewPort.scrollerDivH.scrollLeft;
			}
			this.inaccessibleScrollSettings.lastVScrollPos = viewPort.lastVScrollPos;
			this.inaccessibleScrollSettings.lastHScrollPos = viewPort.lastHScrollPos;
		}
	});

GradebookScrollContext.Constants =
{
	GRADEBOOK_SCROLL_CONTEXT: 'GradebookScrollContext'
};


GradebookScrollContext.getNewInstance = function( model, accessibleMode )
{
	var gradebookScrollContext = new GradebookScrollContext( accessibleMode, model.currentView );
	model.setObject( GradebookScrollContext.Constants.GRADEBOOK_SCROLL_CONTEXT , gradebookScrollContext );
	return gradebookScrollContext;
};

GradebookScrollContext.getExistingInstance = function( model, accessibleMode )
{
	var scrollContext = model.getObject( GradebookScrollContext.Constants.GRADEBOOK_SCROLL_CONTEXT  );
	if (!scrollContext)
	{
		return null;
	}
	if (scrollContext.currentView != model.currentView)
	{
		return null;
	}
	if (scrollContext.accessibleMode != model.accessibleMode)
	{
		return null;
	}
	return scrollContext;
};

Gradebook.Grid = Class.create();

Gradebook.Grid.prototype =
{

	initialize : function(tableId, gradebookService, options, model)
	{

		this.options =
		{
			gradeHistoryEnabled: true,
			scrollerBorderRight : '1px solid #ababab',
			sortBlankImg : 'images/blank.gif',
			topArrowLImg : 'images/toparrowL.gif',
			topArrowRImg : 'images/toparrowR.gif',
			botArrowLImg : 'images/botarrowL.gif',
			botArrowRImg : 'images/botarrowR.gif',
			numFrozenColumns : 0,
			accessibleMode : false
		};
		Object.extend(this.options, options ||
		{});

		this.tableId = tableId;
		this.table = $(tableId);

		this.currentSelectedCell = null;

		if (model)
		{
			this.model = model;
			this.model.removeModelListeners();
			this.model.gradebookService = gradebookService;
		}
		else
		{
			this.model = new Gradebook.GridModel(gradebookService);
		}
		this.model.addModelListener(this);
		// setting the scroll context stored in model to survive page refresh
		var scrollContext = this.model.getObject( "scrollContext" );
		if ( !scrollContext )
		{
			scrollContext = this.model.newObject( "scrollContext" );
			scrollContext.x = 0;
			scrollContext.y = 0;
		}
		this.scrollContext = scrollContext;

		this.initClearAttemptsFlyOut();
		if (this.model.getNumColDefs() === 0)
		{
			this.model.requestLoadData();
		}
		else
		{
			this.model.requestUpdateData();
		}

		this.wrapTable();
	},

	/**
	 * Determines the html table row index of the specified course membership id.
	 *
	 * Returns an object with two properties: a boolean indicating whether the row was found
	 * and if found, the row index of the specified course member.
	 */
	getHtmlRowIndexByUserId: function(userId)
	{
		var visibleRows = this.model.visibleRows;
		var result = {found:false};
		var scrollableColRowIterators = this.model.getRowIterators();

		for (var i=0; i < visibleRows.length; i++)
		{
			if ( scrollableColRowIterators[i].dataArray[0].uid == userId )
			{
				result.index = i;
				result.found = true;
				break;
			}
		}
		return result;
	},

	wrapTable : function()
	{
		var table = this.table;
		// wrap table with a new container div: relative see IE7 bug:
		// http://rowanw.com/bugs/overflow_relative.htm
		table.insert(
			{
				before : "<div id='" + this.tableId + "_container' style='position:relative;'></div>"
			});
		table.previousSibling.appendChild(table);

		if (!this.options.accessibleMode)
		{
			// wrap table with a new viewport div
			table.insert(
				{
					before : "<div id='" + this.tableId + "_viewport'></div>"
				});
			table.previousSibling.appendChild(table);
		}
	},

	modelChanged : function()
	{
		$('loadStatusMsg').update(GradebookUtil.getMessage('creatingGridMsg'));
		this.model.removeModelListeners();
		setTimeout(this.createView.bind(this), 50);
	},

	modelError : function(exception, serverReply)
	{
		this.loaded = true;
		window.model = null;
		parent.gbModel = null;
		if (serverReply)
		{
			// server returned error page instead of json data
			if (exception.name && exception.message)
			{
				document.write(exception.name + ': ' + exception.message + '     ');
			}
			document.write(serverReply);
			document.close();
		}
		else
		{
			$('loadstatus').hide();
			$('loadingGridErrorMsg').update(GradebookUtil.getMessage('errorParsingDataMsg'));
			$('errorLoadingGrid').show();
			if (exception)
			{
				if (exception.name && exception.message)
				{
					$('loadingGridError').update(exception.name + ': ' + exception.message);
				}
				else
				{
					$('loadingGridError').update(exception);
				}
			}
		}
	},

	initClearAttemptsFlyOut : function()
	{
		var clearAttempsFormPanel = $('clearAttemptsFlyOut');
		// direct root child to solve absolute positioning issues
		// clearAttempsFormPanel.remove();
		// document.getElementsByTagName('body')[0].appendChild(
		// clearAttempsFormPanel );
		Event.observe(clearAttempsFormPanel, 'click', function(event)
		{
			Gradebook.doNotCloseAttemptsForm = true;
		});
		Event.observe($('dp_bbDateTimePicker_start_date'), 'click', function(event)
		{
			$('clearAttemptsOptionRange').checked = true;
		});
		Event.observe($('dp_bbDateTimePicker_end_date'), 'click', function(event)
		{
			$('clearAttemptsOptionRange').checked = true;
		});
		Event.observe($('dp_bbDateTimePicker_start_date'), 'change', function(event)
		{
			$('clearAttemptsOptionRange').checked = true;
		});
		Event.observe($('dp_bbDateTimePicker_end_date'), 'change', function(event)
		{
			$('clearAttemptsOptionRange').checked = true;
		});
		Event.observe('selectOption', 'change', function(event)
		{
			$('clearAttemptsOptionSelect').checked = true;
		});
		Gradebook.clearAttemptsFormDefault =
		{};
		Gradebook.clearAttemptsFormDefault.defaultSelect = $('selectOption').value;
		Gradebook.clearAttemptsFormDefault.defaultStartDate = $('dp_bbDateTimePicker_start_date').value;
		Gradebook.clearAttemptsFormDefault.defaultEndDate = $('dp_bbDateTimePicker_end_date').value;
		Gradebook.clearAttemptsFormDefault.defaultStartDateHidden = $('bbDateTimePickerstart').value;
		Gradebook.clearAttemptsFormDefault.defaultEndDateHidden = $('bbDateTimePickerend').value;

		Event.observe('clearAttemptsFlyOutCancel', 'click', function(event)
		{
			$("clearAttemptsFlyOut").style.display = "none";
		});
	},

	createView : function()
	{
		this.options.numFrozenColumns = window.model.getNumFrozenColumns();
		this.modelSortIndex = this.model.getSortIndex();
		this.sortDir = this.model.getSortDir();
		this._sizeHTMLTable();

		// defer initialization that depends on the size of the HTML table.
		// IE10 returns height of 0 for the table at this point. Need to let
		// prior Javascript DOM changes to take effect before executing the rest.
		(function()
		{
			this._initializeHTML();
			this.viewPort = new Gradebook.GridViewPort(this.table, this.model, this.options, this);
			this.model.addModelListener(this.viewPort);
			this.viewPort.refreshContentsH();
			if (this.options.accessibleMode)
			{
				this.setAccessibleViewportSize(); // Set the size after refreshing contents
			}
			this.updateSortImage();
			this.restoreFocus();

			if ( this.options.onLoadComplete ){
				this.options.onLoadComplete();
			}

			this.loaded=true;
		}.bind(this).defer());
	},


	/**
	 * Scrolls the viewport horizontally to display the specified grade item
	 */
	scrollGradeItemIntoViewPort: function( gradableItemId )
	{
		var htmlColumnIndex = this.model.getVisibleColDefIndex( gradableItemId );
		if (htmlColumnIndex == -1)
		{
			return false;
		}
		var htmlColumn = theGradeCenter.grid.isHtmlColumnIndexVisible( htmlColumnIndex );
		if (!htmlColumn.found)
		{
			// grade column is not currently visible.  scroll horizontally to ensure it's in view
			theGradeCenter.grid.viewPort.scrollCols(htmlColumn.diff, true);
		}
		return true;
	},

	/**
	 * Scrolls the viewport vertically to display the specified course member
	 */
	scrollCourseMemberIntoViewPort: function( userId )
	{
		var htmlRow = theGradeCenter.grid.getHtmlRowIndexByUserId( userId );
		if (!htmlRow)
		{
			return false;
		}

		if (!htmlRow.found)
		{
			return false;
		}

		htmlRow = theGradeCenter.grid.isHtmlRowIndexVisible( htmlRow.index );
		if (!htmlRow.isVisible)
		{
			// student row is not currently visible.  scroll vertically to ensure it's in view
			theGradeCenter.grid.viewPort.scrollRows(htmlRow.diff, true);
		}
		return true;
	},

	/**
	 * Returns whether the specified domElement is currently viewable in the grid
	 */
	isGridCellInView: function( domElement )
	{
		var docViewTop =  document.viewport.getScrollOffsets().top;
		var docViewBottom = docViewTop + $(document).viewport.getHeight();
		var viewPortOffset = $(domElement).viewportOffset();
		var elemTop = viewPortOffset.top;
		var elemBottom = elemTop + $(domElement).getHeight();

		return ((elemBottom >= docViewTop) && (elemTop <= docViewBottom) &&
		(elemBottom <= docViewBottom) &&  (elemTop >= docViewTop) );
	},

	/**
	 * Returns whether the specified row is visible in the viewport
	 */
	isHtmlRowIndexVisible: function(index)
	{
		var results = {isVisible:false};
		var numRows = this.viewPort.numVisibleRows;
		var lastRowPos = this.viewPort.lastRowPos;

		if ( index < lastRowPos || index > lastRowPos + numRows )
		{
			results.diff = index - lastRowPos ;
		}
		else
		{
			results.isVisible = true;
		}
		return results;
	},

	/**
	 * Returns whether the specified column is visible in the viewport
	 */
	isHtmlColumnIndexVisible: function(index)
	{
		var numFrozenColumns = this.viewPort.options.numFrozenColumns;
		var numVisibleColumns = this.viewPort.numVisibleCols;
		var colOffset = this.viewPort.colOffset;
		if ( numFrozenColumns >= numVisibleColumns )
		{
			return -1;
		}
		var results = {found:false};
		var items = this.model.getColDefs(false, false);
		var lastColIndex = numVisibleColumns + colOffset - 1;
		var lastViewableColumn = items[ lastColIndex ];

		for (var i = 0, idx = 1; i < items.length; i++)
		{
			if ( i == index )
			{
				results.index = i;
				if ( lastColIndex > results.index )
				{
					results.diff = results.index - lastColIndex;
				}
				else if (results.index > lastColIndex)
				{
					results.diff = results.index - lastColIndex;
				}
				else
				{
					results.found = true;
				}
				break;
			}
		}
		return results;
	},

	setAccessibleViewportSize : function()
	{
		// container div will scroll in accessible mode
		var contDiv = $(this.tableId + '_container');
		var oneRowHeight = 20;
		var h = 0;
		if (this.table.rows.length > 0)
		{
			for (var i=0;i<this.table.rows.length;i++)
			{
				h = h + this.table.rows[i].offsetHeight + 1; // +1 for border spacing
			}
		}
		else
		{
			var rows = this.model.visibleRows.length + 1;
			h = rows * oneRowHeight + 10;
		}
		h = Math.min(this.options.tableHeight, h);
		var w = this.options.tableWidth;
		contDiv.style.height = h + "px";
		contDiv.style.width = w + "px";
		contDiv.style.overflow = "auto";
	},

	_initializeHTML : function()
	{
		if (document.onClickHandler)
		{
			Event.stopObserving(document, 'click', document.onClickHandler);
		}
		document.onClickHandler = this.onDocumentClickHandler.bindAsEventListener(this);
		Event.observe(document, 'click', document.onClickHandler);

		if (this.options.accessibleMode)
		{
			this.setAccessibleViewportSize();
			return;
		}

		var viewportDiv = $(this.tableId + '_viewport');
		viewportDiv.style.height = (this.table.offsetHeight) + "px";
		viewportDiv.style.overflow = "hidden";

		var c, numHCols;

		// add controllers to table cells
		var tableHeader = $(this.table.id + '_header');
		if (tableHeader)
		{
			numHCols = tableHeader.rows[0].cells.length;
			for (c = 0; c < numHCols; c++)
			{
				new Gradebook.CellController(tableHeader.rows[0].cells[c], this, 0, c, true, numHCols);
			}
		}
		var numRows = this.table.rows.length;
		for ( var r = 0; r < numRows; r++)
		{
			var numCols = this.table.rows[0].cells.length;
			for (c = 0; c < numCols; c++)
			{
				var cell = this.table.rows[r].cells[c];
				new Gradebook.CellController(cell, this, r, c, false, numHCols);
			}
		}

		if (document.onKeydownHandler)
		{
			Event.stopObserving(document, 'keydown', document.onKeydownHandler);
		}
		document.onKeydownHandler = this.onDocumentKeyDownHandler.bindAsEventListener(this);
		Event.observe(document, 'keydown', document.onKeydownHandler);
	},

	unload: function() {
		GradebookScrollContext.getNewInstance( this.model, this.options.accessibleMode ).saveScrollCoordinates();
		var numRows = this.table.rows.length;
		var c, cell;
		for ( var r = 0; r < numRows; r++)
		{
			var numCols = this.table.rows[0].cells.length;
			for (c = 0; c < numCols; c++)
			{
				cell = this.table.rows[r].cells[c];
				if (cell.controller)
				{
					cell.controller.unload();
				}
			}
		}
		var tableHeader = $(this.table.id + '_header');
		if (tableHeader)
		{
			var numHCols = tableHeader.rows[0].cells.length;
			for (c = 0; c < numHCols; c++)
			{
				cell = tableHeader.rows[0].cells[c];
				if (cell.controller)
				{
					cell.controller.unload();
				}
			}
		}
		if (this.viewPort)
		{
			this.viewPort.unload();
		}
		this.model.removeModelListeners();
		this.table = null;
		this.model = null;
		this.viewPort = null;
		this.options = null;
		this.sortCell = null;
	},

	_sizeHTMLTable : function()
	{
		var tbl = this.table;
		var tableHeader = $(this.table.id + '_header');
		var numRows = 0;
		var numCols = 0;
		var numFrozenColumns = this.options.numFrozenColumns;
		var i;
		// presence of th impacts the calculation of the row height
		// so we remove it before the calculation occurs
		if (numFrozenColumns === 0)
		{
			for (i = 0; i < tbl.rows.length; i++)
			{
				tbl.rows[i].deleteCell(1);
				if ( tableHeader )
				{
					// no table header in accessible view
					tableHeader.rows[i].deleteCell(1);
				}
			}
			// region is now too small to display msg and count
			$("selectedRowMsg").style.display = 'none';
		}
		else
		{
			$("selectedRowMsg").style.display = 'inline';
		}
		if (this.options.accessibleMode)
		{
			numRows = this.model.getNumRows() + 1 ; //in accessible mode, the same table has the header and content
			numCols = this.model.getNumColDefs();
		}
		else
		{
			var cell = this.table.rows[this.table.rows.length - 1].cells[1]; // skip
			// checkbox
			// column
			cell.height = cell.offsetHeight;
			numRows = parseInt(this.options.tableHeight/cell.offsetHeight, 10);
			var minimumRows = this.model.getMinimumRows( );
			var totalRows = this.model.getNumRows();
			if ( numRows > totalRows )
			{
				// do not show more than we have
				numRows = totalRows;
			}
			else if ( minimumRows > numRows )
			{
				// we want to display more than what can be displayed, so let's extended what is displayed,
				// but no more than the actual total number of students (rows)
				numRows = (minimumRows > totalRows)?totalRows:minimumRows;
			}
			// we do not handle the case where minimumRows < numRows as minimumRows condition is met
			// (we do display more rows than the miminum number asked for)
			numCols = parseInt(this.options.tableWidth / cell.offsetWidth, 10);
		}

		// at least one non-frozen column must be shown
		if (numFrozenColumns + 1 >= numCols)
		{
			numFrozenColumns = numCols - 1;
			this.options.numFrozenColumns = numFrozenColumns;
		}

		// assumes the table has at least 1 row & 2 cols
		// the first column is a frozen column
		// the second column is a non-frozen column

		// clone frozen columns
		for (i = 0; i < numFrozenColumns - 1; i++)
		{
			this._cloneColumn(1); // skip check box column
		}

		// clone non-frozen columns
		var numNonFrozenColumns = numCols - numFrozenColumns - 1;
		for (i = 0; i < numNonFrozenColumns; i++)
		{
			this._cloneColumn(numFrozenColumns + 1); // skip check box column
		}

		var checkColumnWidth = this.table.rows[0].cells[0].offsetWidth;
		var visibleWidth = this.table.offsetWidth;
		this.avgColWidth = (visibleWidth - checkColumnWidth) / numCols;
		var frozenWidth = (numFrozenColumns * this.avgColWidth) + checkColumnWidth;
		if( GradebookUtil.isFirefox() )
		{
			$("selectedRows").style.width = frozenWidth - 2 + "px";
		}
		else if( GradebookUtil.isIE() )
		{
			$("selectedRows").style.width = frozenWidth - 8 + "px";
		}

		// clone rows
		var numRowsToAdd = numRows - tbl.rows.length;

		var rowToClone = tbl.rows[this.table.rows.length - 1];
		for (i = 0; i < numRowsToAdd; i++)
		{
			tbl.tBodies[0].appendChild(rowToClone.cloneNode(true));
		}

		// remove table rows if html table is bigger than numRows
		while (tbl.rows.length > numRows)
		{
			if (tbl.rows.length > 0)
			{
				tbl.deleteRow(tbl.rows.length - 1);
			}
		}

		// remove table columns if html table is bigger than model
		var allRows = tbl.rows;
		while (tbl.rows.length > 0 && tbl.rows[0].cells.length - 1 > this.model.getNumColDefs())
		{
			for (i = 0; i < allRows.length; i++)
			{
				if (allRows[i].cells.length > 1)
				{
					allRows[i].deleteCell(-1);
				}
			}
		}
		while (tableHeader && tableHeader.rows[0].cells.length - 1 > this.model.getNumColDefs())
		{
			tableHeader.rows[0].deleteCell(-1);
		}
	},

	_cloneColumn : function(colIndex)
	{
		var tbl = this.table;
		var i, origCell, newCell;
		for (i = 0; i < tbl.rows.length; i++)
		{
			origCell = tbl.rows[i].cells[colIndex];
			newCell = origCell.cloneNode(true);
			tbl.rows[i].insertBefore(newCell, origCell);
		}
		var tableHeader = $(this.table.id + '_header');
		if (tableHeader)
		{
			tbl = tableHeader;
			for (i = 0; i < tbl.rows.length; i++)
			{
				origCell = tbl.rows[i].cells[colIndex];
				newCell = origCell.cloneNode(true);
				tbl.rows[i].insertBefore(newCell, origCell);
			}
		}
	},

	getAbbrColIndexes : function()
	{
		if (!this.abbrColIndexes)
		{
			this.abbrColIndexes = [];
			/*
			 * Add abbr attributes to specific columns to allow screen readers to
			 * announce meaningful column headers based on the following rules:
			 *
			 * 1. If both first and last name are visible, use those. 2. If the
			 * username is visible, use that. 3. If neither of the first cases pass,
			 * use the first column as the header.
			 */
			var lastNameColIndex = this.model.getVisibleColDefIndex('LN');
			var firstNameColIndex = this.model.getVisibleColDefIndex('FN');
			var userNameColIndex = this.model.getVisibleColDefIndex('UN');
			if (lastNameColIndex != -1 && firstNameColIndex != -1)
			{
				this.abbrColIndexes[ lastNameColIndex ] = true;
				this.abbrColIndexes[ firstNameColIndex ] = true;
			}
			else if (userNameColIndex != -1)
			{
				this.abbrColIndexes[ userNameColIndex ] = true;
			}
			else
			{
				this.abbrColIndexes.push[ 0 ] = true;
			}
		}
		return this.abbrColIndexes;
	},

	onDocumentClickHandler : function(evt)
	{
		if (document.ignoreOnClick || Gradebook.alertLightbox)
		{
			return;
		}
		Gradebook.CellController.prototype.closePopupsAndRestoreFocus(evt);
	},

	onDocumentKeyDownHandler : function(evt)
	{
		if (Gradebook.alertLightbox)
		{
			return;
		}
		if (!Gradebook.CellController.prototype.tableHasFocus)
		{
			return;
		}
		var ek = evt.keyCode;
		var visibleRowCount = this.viewPort.getNumVisibleRows();
		var deltaRow = 0;
		var deltaCol = 0;
		/*
		 * the model grid cell index is R2L agnostic: thus moving right in L2R is
		 * moving towards the next col (+1), while in R2L it is going towards the
		 * previous col (-1).
		 */
		switch (ek)
		{
			case (Event.KEY_LEFT):
				deltaCol = page.util.isRTL() ? 1 : -1;
				break;
			case (Event.KEY_RIGHT):
				deltaCol = page.util.isRTL() ? -1 : 1;
				break;
			case (Event.KEY_UP):
				deltaRow = -1;
				break;
			case (Event.KEY_DOWN):
				deltaRow = 1;
				break;
			case (33/* page up */):
				if (!this.options.accessibleMode)
				{
					deltaRow = -visibleRowCount;
				}
				break;
			case (34/* page down */):
				if (!this.options.accessibleMode)
				{
					deltaRow = visibleRowCount;
				}
				break;
			case (Event.KEY_TAB):
				if (!Gradebook.CellController.currentSelectedCell || !Element.descendantOf(evt.element(), Gradebook.CellController.currentSelectedCell.controller.htmlCell))
				{
					break;
				}
				if (evt.shiftKey)
				{
					if (!evt.element().hasClassName('cmimg') && !this.isFirstCell())
					{
						deltaCol = -1;
						break;
					}
				}
				else if (!this.isLastCell() && (evt.element().hasClassName('cmimg') || this.isCurrentCellWithoutMenu()))
				{
					deltaCol = 1;
				}
				break;
		}
		if (deltaRow === 0 && deltaCol === 0)
		{
			return;
		}
		else
		{
			if (evt)
			{
				Event.stop(evt);
			}
			this.selectRelativeCell(deltaRow, deltaCol);
			Gradebook.CellController.prototype.closePopups(evt);
		}
	},

	isLastCell : function()
	{
		if (!Gradebook.CellController.currentSelectedCell)
		{
			return false;
		}
		// last cell if it is the last displayed cell with no more scroll available
		// right or down
		var nextSelectedCol = Gradebook.CellController.currentSelectedCell.controller.col;
		var nextSelectedRow = Gradebook.CellController.currentSelectedCell.controller.row + 1;

		return (nextSelectedCol >= this.viewPort.numVisibleCols) && (nextSelectedRow >= this.viewPort.numVisibleRows) &&
			((this.viewPort.lastRowPos/* offset */+ this.viewPort.numVisibleRows) == this.model.getNumRows()) &&
			((this.viewPort.colOffset + this.viewPort.numVisibleCols) == this.model.getNumColDefs());
	},

	isFirstCell : function()
	{
		if (!Gradebook.CellController.currentSelectedCell)
		{
			return false;
		}
		return (Gradebook.CellController.currentSelectedCell.controller.col == 1/* checkbox */ &&
		Gradebook.CellController.currentSelectedCell.controller.row === 0 &&
		(!this.viewPort.scrollerDiv /* null if no vertical scroll */  || this.viewPort.scrollerDiv.scrollTop === 0 )
		);
	},

	isCurrentCellWithoutMenu : function()
	{
		// the only cell type that does not display a context menu are calculated
		// columns
		if (!Gradebook.CellController.currentSelectedCell)
		{
			return false;
		}
		var gridCell = Gradebook.CellController.currentSelectedCell.controller.getGridCell();
		if (!gridCell)
		{
			return true;
		}
		return gridCell.isGrade() && !gridCell.canEdit();
	},

	selectRelativeCell : function(deltaRow, deltaCol)
	{
		var visibleRowCount = this.viewPort.getNumVisibleRows();
		var visibleColumnCount = this.viewPort.getNumVisibleCols();
		var modelRowCount = this.model.getNumRows();
		var modelColumnCount = this.model.getNumColDefs();

		var cellController = this.currentCellController;
		if (Gradebook.CellController.currentSelectedCell)
		{
			cellController = Gradebook.CellController.currentSelectedCell.controller;
		}
		var currentSelectedRow = cellController.row;
		var currentSelectedCol = cellController.col - 1; // skip checkbox col
		var selectDelay = 100;

		currentSelectedRow += deltaRow;
		if (currentSelectedRow < 0 || currentSelectedRow >= visibleRowCount)
		{
			currentSelectedRow -= deltaRow;
			selectDelay = 500; // need longer delay to select cell until scroll
			// completes
			if (!this.viewPort.scrollRows(deltaRow))
			{
				if (deltaRow < 0)
				{
					// wrap to bottom of previous col
					if (currentSelectedCol === 0)
					{
						return;
					}
					deltaRow = modelRowCount - visibleRowCount;
					currentSelectedRow = visibleRowCount - 1;
					currentSelectedCol -= 1;
				}
				else
				{
					// wrap to top of next col
					deltaRow = visibleRowCount - modelRowCount;
					currentSelectedRow = 0;
					if (currentSelectedCol < visibleColumnCount - 1)
					{
						currentSelectedCol += 1;
					}
					else
					{
						this.viewPort.scrollCols(1);
					}
				}
				this.viewPort.scrollRows(deltaRow);
			}
		}
		currentSelectedCol += deltaCol;
		if ((currentSelectedCol < this.options.numFrozenColumns && deltaCol < 0) || currentSelectedCol >= visibleColumnCount)
		{
			currentSelectedCol -= deltaCol;
			selectDelay = 500; // need longer delay to select cell until scroll
			// completes
			if (!this.viewPort.scrollCols(deltaCol))
			{
				if (deltaCol < 0)
				{
					if (currentSelectedCol > 0)
					{ // navigate in frozen columns
						currentSelectedCol += deltaCol;
					}
					else
					{
						// wrap to end of previous row
						if (currentSelectedRow === 0)
						{
							return;
						}
						deltaCol = modelColumnCount - visibleColumnCount;
						currentSelectedCol = visibleColumnCount - 1;
						currentSelectedRow -= 1;
					}
				}
				else
				{
					// wrap to beginning of next row
					deltaCol = visibleColumnCount - modelColumnCount;
					currentSelectedCol = 0;
					if (currentSelectedRow < visibleRowCount - 1)
					{
						currentSelectedRow += 1;
					}
					else
					{
						this.viewPort.scrollRows(1);
					}
				}
				this.viewPort.scrollCols(deltaCol);
			}
		}
		// select the current cell after servicing the main event loop to allow
		// current events to complete
		// this was needed for AS-110508 to apply the left/right arrow event to cell
		// navigation only and not to cell editing too.
		this.currentCellController = this.table.rows[currentSelectedRow].cells[currentSelectedCol + 1].controller;
		setTimeout(this.selectCell.bind(this), selectDelay);
	},

	selectCell : function()
	{
		this.currentCellController.selectCell();
	},

	sortColumn : function(newSortCell, sortDir)
	{
		if (newSortCell != this.sortCell)
		{
			this.sortDir = 'ASC';
			if (this.sortCell)
			{
				this.sortCell.setSortImage('NO_SORT'); // remove current sort image
			}
		}
		else
		{
			this.sortDir = (this.sortDir == 'ASC') ? 'DESC' : 'ASC'; // toggle
		}
		if (sortDir)
		{
			this.sortDir = sortDir;
		}
		this.sortCell = newSortCell;
		this.sortCell.setSortImage(this.sortDir); // show new sort image

		// sort the model
		this.modelSortIndex = this.viewPort.toModelIndex(this.sortCell.col - 1); // skip
		// checkbox
		// column
		this.model.sort(this.modelSortIndex, this.sortDir);

		// refresh the view
		this.viewPort.moveScroll(0);
		this.viewPort.refreshContents(0);
	},

	updateSortImage : function()
	{
		if (!this.viewPort)
		{
			return;
		}
		if (this.sortCell)
		{
			this.sortCell.setSortImage('NO_SORT'); // remove current sort image
		}
		var viewSortIndex = this.viewPort.toViewIndex(this.modelSortIndex);
		if (viewSortIndex < 0)
		{
			this.sortCell = null;
		}
		else
		{
			var headerTable = $(this.table.id + '_header');
			if (!headerTable)
			{
				return;
			}
			this.sortCell = headerTable.rows[0].cells[viewSortIndex + 1].controller; // add
			// 1 to
			// account
			// for
			// check
			// column
			this.sortCell.setSortImage(this.sortDir);
		}
	},

	updateNumSelectedIndicator : function()
	{
		var ids = this.model.getCheckedStudentIds();
		$("rowindicator").update(ids.length);
	},

	// focused is restored only in AX view since user has to leave the page for
	// update
	restoreFocus : function()
	{
		if (!this.options || !this.options.accessibleMode || !Gradebook.getModel().lastFocusedRow || !Gradebook.getModel().lastFocusedCol)
		{
			return;
		}
		if ( GradebookUtil.isIE() )
		{
			setTimeout(this.doRestoreFocus.bind(this), 0 );
		}
		else
		{
			this.doRestoreFocus();
		}
	},

	doRestoreFocus : function()
	{
		var lastFocusedRow = Gradebook.getModel().lastFocusedRow;
		var lastFocusedCol = Gradebook.getModel().lastFocusedCol;
		this.table.rows[lastFocusedRow].cells[lastFocusedCol].controller.selectCell();
		Gradebook.getModel().lastFocusedRow = null;
		Gradebook.getModel().lastFocusedCell = null;
	}

};

// Gradebook.GridViewPort --------------------------------------------------
Gradebook.GridViewPort = Class.create();

Gradebook.GridViewPort.prototype =
{

	initialize: function(table, model, options,grid)
	{
		this.isIE = GradebookUtil.isIE();
		this.isFF = GradebookUtil.isFirefox();
		this.table = table;
		this.model = model;
		this.options = options;
		this.grid = grid;
		this.lastPixelOffset = 0;
		this.colOffset = 0;
		this.lastRowPos = 0;
		this.startScrollLeft = 0;
		this.headerTableId = this.table.id + '_header';
		this.headerTable   = $(this.headerTableId);
		if (!this.headerTable)
		{
			this.headerTable = this.table;
		}
		this.numVisibleRows = this.table.rows.length;
		if ( this.headerTable.rows[0] )
		{
			this.numVisibleCols = this.headerTable.rows[0].cells.length-1; // don't include check column
		}
		this.div = this.table.parentNode;
		this.initScrollers();
		this.updateLastModifiedTS();
		this.restoreInteractiveModeScrollCoordinates();
	},

	unload: function()
	{
		this.grid = null;
		this.model = null;
		this.table = null;
		this.headerTable = null;
		this.div = null;
		this.scrollerDiv = null;
		this.heightDiv = null;
		this.scrollerDivH  = null;
		this.widthDiv = null;
		this.options = null;
	},

	restoreInteractiveModeScrollCoordinates: function() {
		var gradebookScrollContext = GradebookScrollContext.getExistingInstance( this.model, this.options.accessibleMode );
		if ( !gradebookScrollContext || gradebookScrollContext.accessibleMode )
		{
			return;
		}
		if ( this.scrollerDiv )
		{
			this.scrollerDiv.scrollTop = gradebookScrollContext.inaccessibleScrollSettings.scrollTop;
		}

		this.lastVScrollPos = gradebookScrollContext.inaccessibleScrollSettings.lastVScrollPos;
		if ( this.scrollerDivH )
		{
			this.scrollerDivH.scrollLeft = gradebookScrollContext.inaccessibleScrollSettings.scrollLeft;
			this.setColOffsetFromScrollOffset();
		}
		this.lastHScrollPos = gradebookScrollContext.inaccessibleScrollSettings.lastHScrollPos;
		if ( this.scrollerDiv )
		{
			var contentOffset = parseInt( this.scrollerDiv.scrollTop / parseInt(this.rowHeight, 10), 10 );
			this.lastRowPos = contentOffset;
		}
	},

	modelChanged: function()
	{
		this.updateLastModifiedTS();
		this.refreshContentsH();
		this.grid.updateNumSelectedIndicator();
	},

	updateLastModifiedTS: function()
	{
		var t = this.model.lastLogEntryTS;
		if (!t)
		{
			return;
		}

		var gcFrame = (top.content.gradecenterframe) ? top.content.gradecenterframe : top.content;
		$( gcFrame.document.getElementById('timeStampDiv')).update( gcFrame.LastSavedMsg + t );
	},

	getHeaderGridCell: function(col)
	{
		if (col > 0)
		{
			col -= 1; // skip check col
		}
		if (col >= this.options.numFrozenColumns)
		{
			col += this.colOffset;
		}
		var iterator = this.model.getColDefIterator(col);
		if (!iterator || !iterator.hasNext())
		{
			GradebookUtil.error('getHeaderGridCell cannot get header cell for col: '+col);
		}
		return iterator.next();
	},

	getNumVisibleRows: function()
	{
		return this.numVisibleRows;
	},

	getNumVisibleCols: function() {
		return this.numVisibleCols;
	},

	populateRow: function(htmlRow, frozenColRowIterator, scrollableColRowIterator)
	{
		var numFrozenColumns = this.options.numFrozenColumns;
		for (var j=0; j < (this.numVisibleCols); j++)
		{
			var iterator = (j < numFrozenColumns)?frozenColRowIterator:scrollableColRowIterator;
			var dataCell = iterator.next();
			var htmlCell = htmlRow.cells[j+1];
			// set check box column based on isRowChecked flag for first data cell
			if (j === 0)
			{
				var checkInput = GradebookUtil.getChildElementByClassName(htmlRow.cells[0], 'input', 'checkInput');
				checkInput.checked = dataCell.metaData.isRowChecked;
			}
			htmlCell.controller.renderHTML(dataCell);
		}
	},

	refreshContents: function(rowOffset)
	{
		if (this.model.getNumRows() === 0)
		{
			return;
		}
		if (this.options.accessibleMode)
		{
			this.refreshAccessibleContents();
			return;
		}
		var numRows = this.numVisibleRows;
		var numModelRows = this.model.getNumRows();
		if (rowOffset + numRows > numModelRows)
		{
			rowOffset = numModelRows - numRows - 1;
		}
		var numFrozenColumns = this.options.numFrozenColumns;
		var frozenColRowIterators = this.model.getRowIterators(rowOffset, numRows, 0);
		var scrollableColRowIterators = frozenColRowIterators;
		if (this.numVisibleCols > numFrozenColumns)
		{
			scrollableColRowIterators = this.model.getRowIterators(rowOffset, numRows, numFrozenColumns+this.colOffset);
		}
		for (var i=0; i < numRows; i++)
		{
			this.populateRow(this.table.rows[i], frozenColRowIterators[i], scrollableColRowIterators[i]);
		}
		this.lastRowPos = rowOffset;
	},

	restorePreviousAccessibleModeScrollCoordinates: function()
	{
		var gradebookScrollContext = GradebookScrollContext.getExistingInstance( this.model, this.options.accessibleMode );
		if ( gradebookScrollContext && gradebookScrollContext.accessibleMode )
		{
			var accessibleContainer = document.getElementById('table1_accessible_container');
			accessibleContainer.scrollTop = gradebookScrollContext.accessibleScrollSettings.y;
			accessibleContainer.scrollLeft = gradebookScrollContext.accessibleScrollSettings.x;
		}
	},

	refreshAccessibleContents : function()
	{
		var numModelRows = this.model.getNumRows();
		var iters = this.model.getRowIterators();
		var numCols = this.table.rows[0].cells.length - 1; // skip check column
		var start = new Date().getTime();
		if (this.refreshRowCounter === undefined || this.refreshRowCounter === null)
		{
			this.refreshRowCounter = 0;
		}
		var abbrColIndexes = this.grid.getAbbrColIndexes();
		for ( var i = this.refreshRowCounter; i < numModelRows; i++)
		{
			var htmlRowIndex = i + 1; // skip header row
			var htmlRow = this.table.rows[htmlRowIndex];
			var htmlCell;
			// if we are rendering for more than 3 seconds, give Firefox some time to
			// get
			// rid of the "unresponsive script" message.
			if (new Date().getTime() - start > 3000)
			{
				setTimeout(this.refreshAccessibleContents.bind(this), 0);
				return;
			}
			var rowTitle = GradebookUtil.getMessage('selectUserMsg');
			for ( var j = 0; j < numCols; j++)
			{
				var dataCell = iters[i].next();
				htmlCell = htmlRow.cells[j + 1]; // skip check column
				if (!htmlCell.controller)
				{
					new Gradebook.CellController(htmlCell, this.grid, htmlRowIndex, j + 1, false /* not a header cell */ );
				}
				htmlCell.controller.renderHTML(dataCell);
				if ( abbrColIndexes[ j ] )
				{
					htmlCell.abbr = htmlCell.controller.getGridCell().getValue();
					htmlCell.scope = 'row';
					rowTitle += " " + htmlCell.controller.getGridCell().getValue();
				}
				// set check box column based on isRowChecked flag for first grid cell
				if (j === 0)
				{
					htmlCell = htmlRow.cells[0];
					if (!htmlCell.controller)
					{
						new Gradebook.CellController(htmlCell, this.grid, htmlRowIndex, j, false /* not a header cell */ );
					}
					var checkInput = $(htmlCell).down('input');
					checkInput.checked = dataCell.metaData.isRowChecked;
				}
			}
			$(htmlRow.cells[0]).down('input').title = rowTitle;

			this.refreshRowCounter++;
		}
		this.refreshRowCounter = null;
		setTimeout(this.restorePreviousAccessibleModeScrollCoordinates.bind(this), 0 );
	},

	refreshContentsH : function()
	{
		// refresh data cells
		this.refreshContents(this.lastRowPos);
		// refresh the header cells
		var numFrozenColumns = this.options.numFrozenColumns;
		var hdrCells = null;
		var hdr = $(this.table.id + '_header');
		if (hdr)
		{
			hdrCells = hdr.rows[0].cells;
		}
		else
		{
			hdrCells = this.table.rows[0].cells;
		}
		if (!hdrCells)
		{
			return;
		}
		var frozenColIterator = this.model.getColDefIterator(0);
		var scrollableColIterator = null;
		if (this.numVisibleCols > numFrozenColumns)
		{
			scrollableColIterator = this.model.getColDefIterator(numFrozenColumns + this.colOffset);
		}
		if (!hdrCells[0].controller)
		{
			var ctrl = new Gradebook.CellController(hdrCells[0], this.grid, 0, 0, true);
			if (this.options.accessibleMode)
			{
				ctrl._accessibleInit();
			}
		}
		for ( var i = 0; i < this.numVisibleCols; i++)
		{
			var iterator = (i < numFrozenColumns) ? frozenColIterator : scrollableColIterator;
			var htmlCell = hdrCells[i + 1]; // skip check column
			var colDef = iterator.next();
			if (!htmlCell.controller)
			{
				new Gradebook.CellController(htmlCell, this.grid, 0, i + 1, true);
			}
			htmlCell.controller.renderHeaderCellHTML(colDef);
		}
		// add the check all listener if not present
		if (!hdrCells[0].controller)
		{
			new Gradebook.CellController(hdrCells[0], this.grid, 0, 0, true);
		}
		this.grid.updateSortImage();
	},

	visibleHeight : function()
	{
		return parseInt(GradebookUtil.getElementsComputedStyle(this.div, 'height'), 10);
	},

	toViewIndex : function(modelSortIndex)
	{
		var numFrozenColumns = this.options.numFrozenColumns;
		if (modelSortIndex < numFrozenColumns)
		{
			return modelSortIndex;
		}
		var vi = (modelSortIndex - this.colOffset);
		if (numFrozenColumns <= vi && vi < this.numVisibleCols)
		{
			return vi;
		}
		else
		{
			return -1;
		}
	},

	toModelIndex : function(viewSortIndex)
	{
		if (viewSortIndex == -1)
		{
			return -1;
		}

		var numFrozenColumns = this.options.numFrozenColumns;
		var mi = (viewSortIndex < numFrozenColumns) ? viewSortIndex : (this.colOffset + viewSortIndex);
		return mi;
	},

	// scrolling management

	initScrollers : function()
	{
		this.createVScrollBar();
		this.createHScrollBar();
		this.lastVScrollPos = 0;
		if (this.scrollerDivH)
		{
			this.lastHScrollPos = this.scrollerDivH.scrollLeft;
		}
		else
		{
			this.lastHScrollPos = 0;
		}
		this.startScrollLeft = this.lastHScrollPos;
	},

	createVScrollBar : function()
	{
		// see comments on createHScroolBar()
		if (this.table.rows.length >= this.model.getNumRows())
		{
			return;
		}
		var visibleHeight = this.visibleHeight();
		// rule of third: we have X rows to display, only Y are visible
		// and the height for the Y is visibleHeight, what should be the
		// height for all? totalHeight = ( visibleHeight / Y ) * X
		var numVisibleRows = this.table.rows.length;
		this.rowHeight = parseInt(visibleHeight / numVisibleRows, 10);
		visibleHeight = this.rowHeight * numVisibleRows; // just in case rowHeight
	                                                     // was rounded
		if( this.isFF )
		{
			visibleHeight -= 1;
		}
		if( this.isIE )
		{
			visibleHeight += 2;
		}
		var divHeight = this.rowHeight * this.model.getNumRows();

		// create the outer div...
		this.scrollerDiv = document.createElement("div");
		var scrollerStyle = this.scrollerDiv.style;
		scrollerStyle.borderRight = this.options.scrollerBorderRight;
		scrollerStyle.position = "absolute";
		var tableWidth = this.isIE ? this.table.offsetWidth - 3 + "px" : this.table.offsetWidth - 5 + "px";
		if (document.documentElement.dir == 'rtl')
		{
			scrollerStyle.right = tableWidth;
		}
		else
		{
			scrollerStyle.left = tableWidth;
		}
		scrollerStyle.top = "1px";
		scrollerStyle.height = this.isFF ? visibleHeight + "px" : visibleHeight - 1 +"px";
		scrollerStyle.overflowY = "scroll";

		// create the inner div...
		this.heightDiv = document.createElement("div");
		this.heightDiv.style.width = "1px";

		this.heightDiv.style.height = parseInt(divHeight, 10) + "px";
		this.scrollerDiv.appendChild(this.heightDiv);
		Event.observe(this.scrollerDiv, 'scroll', this.handleVScroll.bindAsEventListener(this));

		this.table.parentNode.parentNode.insertBefore(this.scrollerDiv, this.table.parentNode.nextSibling);
		var eventName = this.isIE ? "mousewheel" : "DOMMouseScroll";
		Event.observe(this.table, eventName, function(evt)
		{
			if (evt.wheelDelta >= 0 || evt.detail < 0) // wheel-up
			{
				this.scrollerDiv.scrollTop -= (2 * this.rowHeight);
			}
			else
			{
				this.scrollerDiv.scrollTop += (2 * this.rowHeight);
			}
			this.handleVScroll();
		}.bindAsEventListener(this), false);
	},

	createHScrollBar : function()
	{
		// logic here is to create an div the same width that the non frozen
		// columns
		// then put inside it an invisible inner div that would be the width of
		// the non
		// frozen if they were all visible; by setting the parent with overflow:
		// auto
		// scroll bars will appear, and the scrolling events are captured to decide
		// what
		// portion of the table should be displayed.
		if (!this.headerTable.rows[0] || this.headerTable.rows[0].cells.length > this.model.getNumColDefs())
		{
			return;
		}
		var totalColumnCount = this.model.getNumColDefs();
		var visibleColumnCount = this.numVisibleCols;
		var numFrozenColumns = this.options.numFrozenColumns;
		this.maxColOffset = totalColumnCount - (visibleColumnCount - numFrozenColumns);

		var visibleHeight = this.isFF ? this.table.offsetHeight - 1 : this.table.offsetHeight - 2;
		var checkColumnWidth = this.headerTable.rows[0].cells[0].offsetWidth;
		// set avg col width to be based on actual cell width (not including
		// padding, etc.)
		// this will allow scrolling to be more accurate
		this.avgColWidth = this.headerTable.rows[0].cells[1].offsetWidth;
		var frozenWidth = (numFrozenColumns * this.avgColWidth) + checkColumnWidth;
		var visibleWidth = (visibleColumnCount - numFrozenColumns) * this.avgColWidth;

		// create the outer div...
		this.scrollerDivH = document.createElement("div");
		var scrollerStyle = this.scrollerDivH.style;
		scrollerStyle.position = "absolute";
		if (document.documentElement.dir == 'rtl')
		{
			if( this.isFF )
			{
				scrollerStyle.right = frozenWidth + "px";
			}
			else if( this.isIE )
			{
				scrollerStyle.right = frozenWidth + 4 + "px";
			}
			else
			{
				scrollerStyle.right = frozenWidth + 3 + "px";
			}
		}
		else
		{
			if( this.isFF )
			{
				scrollerStyle.left = frozenWidth + "px";
			}
			else if( this.isIE )
			{
				scrollerStyle.left = frozenWidth - 4 + "px";
			}
			else
			{
				scrollerStyle.left = frozenWidth - 3 + "px";
			}
		}

		scrollerStyle.top = visibleHeight + "px";
		scrollerStyle.width = visibleWidth + "px";
		scrollerStyle.overflowX = "scroll";

		// create the inner div...
		this.widthDiv = document.createElement("div");
		this.widthDiv.style.height = "1px";
		this.widthDiv.style.direction = 'ltr';
		this.widthDiv.style.width = (this.avgColWidth * (totalColumnCount - numFrozenColumns)) + "px";
		this.scrollerDivH.appendChild(this.widthDiv);
		Event.observe(this.scrollerDivH, 'scroll', this.handleHScroll.bindAsEventListener(this));

		if (this.scrollerDiv)
		{
			this.table.parentNode.parentNode.insertBefore(this.scrollerDivH, this.scrollerDiv.nextSibling);
		}
		else
		{
			this.table.parentNode.parentNode.insertBefore(this.scrollerDivH, this.table.parentNode.nextSibling);
		}
		//Scrolling Hint Logic starts Here
		// Find the first parent of containerdiv which sets the positioning reference (either relative or absolute)
		var relativePositionElement = $( 'containerdiv' );
		while ( relativePositionElement )
		{
			var position = relativePositionElement.getStyle( 'position' );
			if ( position && ( position == 'relative' || position == 'absolute' ) )
			{
				break; // we found the element used to a the origin for any positioning
			}
			relativePositionElement = relativePositionElement.up( );
		}
		var positionOffset = relativePositionElement.cumulativeOffset();
		// if those values change, then that means the scroll bar is redrawn so we can do it outside
		var scrollArrowButtonOffset = 12; // the [<]xxxxxxx[>] arrows, not sure we can actually get their actual width since this is browser widget
		var startX = -1, startY = -1, endY = -1;
		var scrollBarWidth = visibleWidth - 2*scrollArrowButtonOffset;
		var isR2L = page.util.isRTL();
		var columnHint = function( event )
		{
			if ( !this.scrollerDivH || !$('selectedRows') ) return;
			if ( startX < 0 )
			{
				if ( isR2L )
				{
					startX = this.scrollerDivH.cumulativeOffset( ).left + scrollArrowButtonOffset;
					startY = $('selectedRows').cumulativeOffset().top;
					endY = startY + $('selectedRows').offsetHeight;
				}
				else
				{
					startX = this.scrollerDivH.cumulativeOffset( ).left + scrollArrowButtonOffset;
					startY = $('selectedRows').cumulativeOffset().top;
					endY = startY + $('selectedRows').offsetHeight;
				}
			}
			var x = event.pointerX( );
			var y = event.pointerY( );
			var hintbox = $( 'hintbox' );
			if ( x > startX && y > startY && y < endY )
			{
				if ( !hintbox )
				{
					hintbox = document.createElement("div");
					hintbox.id = 'hintbox';
					hintbox.className = 'scrollHint';
					$('containerdiv').appendChild( hintbox );
				}
				var xOffset = x - startX;
				var colOffset = (isR2L?1:numFrozenColumns) + Math.floor( ( xOffset / scrollBarWidth ) * ( totalColumnCount - numFrozenColumns )  );
				var col = this.model.getColumnByIndex( isR2L?( totalColumnCount - colOffset ):colOffset );
				if ( col )
				{
					hintbox.innerHTML = col.getName( );
					var hintLeft = ( x - positionOffset.left );
					hintbox.style.left = hintLeft + 'px';
					hintbox.style.top  = ( y - positionOffset.top + 20 ) + 'px';
					hintbox.show( );
					var bodyWidth = $(document.body).getWidth();
					var hintwidth = $(hintbox).getWidth();
					if (hintLeft + hintwidth > bodyWidth)
					{
						hintLeft = bodyWidth - hintwidth;
						hintbox.style.left = hintLeft + 'px';
					}
				}
				else
				{
					$( 'hintbox' ).innerHTML = '';
					hintbox.hide( );
				}
			}
			else
			{
				if ( hintbox )
				{
					hintbox.hide( );
				}
			}
		};
		$('containerdiv').observe('mousemove', columnHint.bind( this ) );
		$('containerdiv').observe('mousedown', function( ) { if ( $( 'hintbox' ) ) $( 'hintbox' ).hide( ); } );
		// End Of Hint related logic
	},

	rowToPixel : function(rowOffset)
	{
		return (rowOffset / this.model.getNumRows()) * this.heightDiv.offsetHeight;
	},

	moveScroll : function(rowOffset)
	{
		if (this.scrollerDiv)
		{
			this.scrollerDiv.scrollTop = this.rowToPixel(rowOffset);
		}
	},

	/* When scrolling, IE sends multiple onscroll events for a single scroll action by the user.
	 To get around this, we set a timer and wait until the dust settles before doing the scroll
	 Here is info on the work around: http://support.microsoft.com/kb/238004
	 */
	// scroll numRows, can be negative. returns false if scroll request is out of range
	scrollRows : function(numRows)
	{
		if (!this.scrollerDiv)
		{
			return false;
		}
		if ((numRows < 0 && this.scrollerDiv.scrollTop === 0) || (numRows > 0 && this.lastRowPos == (this.model.getNumRows() - this.numVisibleRows)))
		{
			return false;
		}
		this.ignoreOnVscroll = true;
		this.scrollerDiv.scrollTop += (numRows * this.rowHeight);
		setTimeout(this.doVScroll.bind(this), 200 );
		return true;
	},

	handleVScroll : function(evt)
	{
		if ( this.ignoreOnVscroll || Gradebook.alertLightbox )
		{
			return;
		}
		this.ignoreOnVscroll = true;
		setTimeout(this.doVScroll.bind(this), 200);
	},

	doVScroll : function()
	{
		var incomingscrollTop = this.scrollerDiv.scrollTop;
		var scrollDiff = this.lastVScrollPos - this.scrollerDiv.scrollTop;
		if (scrollDiff !== 0.00)
		{
			// Only tell the cellcontroller if we're actually going to do something.
			Gradebook.CellController.prototype.onGridScroll();
			var r = this.scrollerDiv.scrollTop % this.rowHeight;
			if (r !== 0)
			{
				if (scrollDiff < 0)
				{
					this.scrollerDiv.scrollTop += (this.rowHeight - r);
				}
				else
				{
					this.scrollerDiv.scrollTop -= r;
				}
			}
			var contentOffset = Math.round(parseInt(this.scrollerDiv.scrollTop, 10) / parseInt(this.rowHeight, 10));
			this.refreshContents(contentOffset);
			this.lastVScrollPos = this.scrollerDiv.scrollTop;
		}
		this.ignoreOnVscroll = false;
	},

	handleHScroll : function(evt)
	{
		if (this.ignoreOnHscroll || Gradebook.alertLightbox )
		{
			return;
		}
		this.ignoreOnHscroll = true;
		setTimeout(this.doHScroll.bind(this), 200);
	},

	// scroll numCols, can be negative. returns false if scroll request is out of
	// range
	scrollCols : function(numCols)
	{
		if (!this.scrollerDivH)
		{
			return false;
		}
		var totalColumnCount = this.model.getNumColDefs();

		if ((numCols < 0 && this.scrollerDivH.scrollLeft === 0) || (numCols > 0 && this.colOffset == (this.model.getNumColDefs() - this.numVisibleCols)))
		{
			return false;
		}
		this.ignoreOnHscroll = true;
		/*
		 * so here we need to translate delta to actual scroll value. The delta is
		 * screen orientation agnostic (we need to move to that col in the model) we
		 * need to translate the move in a pixel move to the left: a move to the
		 * left in l2r means we move to the next col, while in r2l it means we move
		 * to previous col, thus the inversion of orientation if r2l.
		 */
		this.scrollerDivH.scrollLeft += (numCols * this.avgColWidth * (page.util.isRTL() ? -1 : 1));
		setTimeout(this.doHScroll.bind(this), 200);
		return true;
	},

	doHScroll : function()
	{
		var scrollDiff = this.lastHScrollPos - this.scrollerDivH.scrollLeft;
		if (scrollDiff !== 0.00)
		{
			// Only tell the cellcontroller if we're actually going to do something.
			var done = Gradebook.CellController.prototype.onGridScroll();
			if(done)
			{
				// To align the column scroll - we move by column increment
				var r = this.scrollerDivH.scrollLeft % this.avgColWidth;
				if (r !== 0)
				{
					r = Math.abs(r);
					if (scrollDiff < 0)
					{
						this.scrollerDivH.scrollLeft += (this.avgColWidth - r);
					}
					else
					{
						this.scrollerDivH.scrollLeft -= r;
					}
				}
				this.setColOffsetFromScrollOffset();
				this.refreshContentsH();
				this.lastHScrollPos = this.scrollerDivH.scrollLeft;
			}
		}
		this.ignoreOnHscroll = false;
	},

	setColOffsetFromScrollOffset: function()
	{
		var offset = 0;
		if ( document.documentElement.dir == 'rtl' )
		{
			// Subtract the max scroll left with the current one and divide with the avgColWidth
			offset = Math.round( (this.startScrollLeft - this.scrollerDivH.scrollLeft) / this.avgColWidth);
			if (offset < 0)
			{
				// IE8 Standards mode generates a negative offset with the above logic, but IE7 does not.
				// In an attempt to resolve this without figuring out every single line of this fake scrolling
				// support, let's go with the number that works in this case.
				offset = Math.round(this.scrollerDivH.scrollLeft / this.avgColWidth);
			}
		}
		else
		{
			offset = Math.round(this.scrollerDivH.scrollLeft / this.avgColWidth);
		}
		this.colOffset = Math.min( offset, this.maxColOffset );
	},

	selectCell: function( modelLoc )
	{
		if ( modelLoc.col >= this.options.numFrozenColumns && modelLoc.col < this.options.numFrozenColumns + this.colOffset )
		{
			this.colOffset = modelLoc.col - this.options.numFrozenColumns;
		}
		else if ( modelLoc.col >= this.options.numFrozenColumns && modelLoc.col >= this.colOffset + this.numVisibleCols )
		{
			this.colOffset = modelLoc.col - this.numVisibleCols + 1;
		}

		if ( modelLoc.row < this.lastRowPos )
		{
			this.lastRowPos = modelLoc.row;
		}
		else if ( modelLoc.row >= this.lastRowPos + this.numVisibleRows )
		{
			this.lastRowPos = modelLoc.row - this.numVisibleRows + 1;
		}
		this.scrollerDivH.scrollLeft = this.avgColWidth * this.colOffset * (page.util.isRTL() ? -1 : 1);
		this.scrollerDiv.scrollTop = parseInt(this.rowHeight, 10) * this.lastRowPos;
		this.refreshContentsH();
		var row = modelLoc.row - this.lastRowPos;
		var col = ( modelLoc.col < this.options.numFrozenColumns ) ? modelLoc.col : modelLoc.col - this.colOffset;
		var htmlCell = this.table.rows[row].cells[col+1];
		htmlCell.controller.selectCell.bind( htmlCell.controller )();
	}

};
/**
 *  Gradebook data grid
 *
 *  PORTIONS OF THIS FILE ARE BASED ON RICO LIVEGRID 1.1.2
 *
 *  Copyright 2005 Sabre Airline Solutions
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this
 *  file except in compliance with the License. You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software distributed under the
 *  License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
 *  either express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 *
 *  @author "Bill Richard"
 *  @version
 *
 **/

// Gradebook.GridService -----------------------------------------------------
function detach(n, u, w, h)
{
	var lpix = screen.width - w;
	var remote = window.open(u, n, 'width=' + w + ',height=' + h + ',resizable=yes,scrollbars=yes,status=no,top=20,left=' + lpix);
	if (remote)
	{
		remote.focus();
		if (!remote.opener)
		{
			remote.opener = self;
		}
		window.top.name = 'bbWin';
	}
}

Gradebook.GridService = Class.create();

Gradebook.GridService.prototype =
{

	initialize : function(courseId)
	{
		this.courseId = courseId;
		this.getDataURL = '/webapps/gradebook/do/instructor/getJSONData?course_id=' + this.courseId;
		this.deleteColumnURL = '/webapps/gradebook/do/instructor/deleteItem?course_id=' + this.courseId;
		this.adaptiveReleaseColumnURL = '/webapps/blackboard/execute/course/courseMapPicker?displayMode=dashboardMap&course_id=' + this.courseId;
		this.editContentURL = '/webapps/gradebook/do/instructor/goto?dispatch=editContent&course_id=' + this.courseId;
		this.modifyColumnURL = '/webapps/gradebook/do/instructor/addModifyItemDefinition?actionType=modify&course_id=' + this.courseId;
		this.modifyCumulativeColumnURL = '/webapps/gradebook/do/instructor/manageCumulativeItem?dispatch=addModifyFormulaItem&course_id=' + this.courseId;
		this.gradeDetailsURL = '/webapps/gradebook/do/instructor/viewGradeDetails?course_id=' + this.courseId;
		this.clearAttemptsURL = '/webapps/gradebook/do/instructor/clearAttempt?courseMembershipId=-1&course_id=' + this.courseId;
		this.viewItemStatsURL = '/webapps/gradebook/do/instructor/viewItemStats?course_id=' + this.courseId;
		this.viewStudentStatsURL = '/webapps/gradebook/do/instructor/viewStudentStats?course_id=' + this.courseId;
		this.getMessagesURL = '/webapps/gradebook/gradebook2/instructor/model_messages.jsp?course_id=' + this.courseId;
		this.runReportURL = '/webapps/blackboard/execute/reporting/displayDefinitions?nav_bridge=cp_gradebook2_learner_statistics_report&report_type=learner.statistics&course_id=' + this.courseId;
	},

	requestLoadData : function(onSuccessCallBack, onFailureCallBack, onExceptionCallBack, forceFlush)
	{
		var url = this.getDataURL;
		if (forceFlush)
		{
			url += "&flush=true";
		}
		new Ajax.Request(url,
			{
				method : 'get',
				onSuccess : onSuccessCallBack,
				onFailure : onFailureCallBack,
				onException : onExceptionCallBack,
				requestHeaders :
					[ 'cookie', document.cookie ]
			});
	},

	requestLoadMessages : function(onSuccessCallBack, onFailureCallBack, onExceptionCallBack)
	{
		var url = this.getMessagesURL;
		new Ajax.Request(url,
			{
				method : 'get',
				onSuccess : onSuccessCallBack,
				onFailure : onFailureCallBack,
				onException : onExceptionCallBack,
				requestHeaders :
					[ 'cookie', document.cookie ]
			});
	},

	makeAjaxRequest : function(url, callBack)
	{
		new Ajax.Request(url,
			{
				method : 'get',
				onSuccess : callBack,
				requestHeaders :
					[ 'cookie', document.cookie ]
			});
	},

	requestUpdateData : function(version, lastUserChangeTS, usersHash, scoreProvidersHash, customViewId, onSuccessCallBack, onFailureCallBack, onExceptionCallBack)
	{
		var url = this.getDataURL + '&version=' + version + '&lastUserChangeTS=' + lastUserChangeTS + '&usersHash=' + usersHash + '&scoreProvidersHash=' + scoreProvidersHash;
		if (customViewId)
		{
			url += '&customViewId=' + customViewId;
		}
		new Ajax.Request(url,
			{
				method : 'get',
				onSuccess : onSuccessCallBack,
				onFailure : onFailureCallBack,
				requestHeaders :
					[ 'cookie', document.cookie ],
				onException : onExceptionCallBack
			});
	},

	updateGrade : function(callback, bookVersion, newValue, newTextValue, userId, colDefId)
	{
		GradebookDWRFacade.updateGrade(parseInt(this.getCourseId(), 10), parseInt(bookVersion, 10), (newValue.length > 0) ? parseFloat(newValue) : newValue,
			newTextValue, parseInt(userId, 10), parseInt(colDefId, 10), callback);
	},

	clearAll : function(callback, bookVersion, isDelete, userId, colDefId)
	{
		GradebookDWRFacade.clearAll(parseInt(this.getCourseId(), 10), parseInt(bookVersion, 10), isDelete, parseInt(userId, 10), parseInt(colDefId, 10), callback);
	},

	clearSelected : function(callback, bookVersion, attemptIds, isDelete, userId, colDefId)
	{
		GradebookDWRFacade.clearSelected(parseInt(this.getCourseId(), 10), parseInt(bookVersion, 10), attemptIds, isDelete, parseInt(userId, 10), parseInt(
			colDefId, 10), callback);
	},

	deleteColumn : function(colDefId)
	{
		var frm = document.deleteColumnForm;
		frm.itemId.value = colDefId;
		frm.submit();
		//var url = this.deleteColumnURL + "&itemId="+colDefId;
		//window.location.href = url;
	},

	viewItemStats : function(itemId)
	{
		var url = this.viewItemStatsURL + "&itemId=" + itemId;
		window.location.href = url;
	},

	viewStudentStats : function(userId)
	{
		var url = this.viewStudentStatsURL + "&userId=" + userId;
		window.location.href = url;
	},

	runReport : function(userId)
	{
		var url = this.runReportURL + "&user_id=" + userId;
		window.location.href = url;
	},

	modifyColumn : function(colDefId, colType)
	{
		var url = this.modifyColumnURL + '&id=' + colDefId;
		if (colType != 'N')
		{
			url = this.modifyCumulativeColumnURL + '&itemId=' + colDefId;
		}

		window.location.href = url;
	},

	viewAdaptiveRelease : function( institutionUserId )
	{
		var url = this.adaptiveReleaseColumnURL + '&user_id=' + institutionUserId;
		detach('newwin', url, '350', '350');
	},

	showGradeDetails : function(userId, colDefId, focusCellId)
	{
		/* AS-109344: Need to make sure the outcomeDefinitionId & courseMembershipId are same when coming back from the view attempt page for building block */
		var url = this.gradeDetailsURL + '&outcomeDefinitionId=_' + colDefId + '_1&courseMembershipId=_' + userId + '_1&focus_cell_id=' + focusCellId;
		window.location.href = url;
	},

	// TODO - why are these fieldids passed in?  There is apparently only one caller and they never change...
	// The newer logic around the vtbe and the readonly view assumes the single use-case field and div names
	loadComments: function(userId, itemId, studentCommentFieldId, instructorCommentFieldId)
	{
		var svc = this;
		$('readOnlyStudentComments').hide();
		$('readOnlyInstructorComments').hide();
		$('instructorCommentsTextDiv').hide();
		$('studentCommentsTextDiv').hide();
		GradebookDWRFacade.getComments(parseInt(this.getCourseId(), 10), userId, itemId, function(comments) {
			svc.studentComment = comments.studentComment;
			svc.instructorComment = comments.instructorComment;
			dwr.util.setValue(studentCommentFieldId, comments.studentComment);
			dwr.util.setValue(instructorCommentFieldId, comments.instructorComment);
			if (comments.studentComment.indexOf('<') != -1)
			{
				$('readOnlyStudentComments').update(comments.studentComment);
				$('readOnlyStudentComments').show();
				$('studentCommentsTextDiv').hide();
			}
			else
			{
				$('readOnlyStudentComments').hide();
				$('studentCommentsTextDiv').show();
			}
			if (comments.instructorComment.indexOf('<') != -1)
			{
				$('readOnlyInstructorComments').update(comments.instructorComment);
				$('readOnlyInstructorComments').show();
				$('instructorCommentsTextDiv').hide();
			}
			else
			{
				$('readOnlyInstructorComments').hide();
				$('instructorCommentsTextDiv').show();
			}
		});
	},

	loadAttemptsInfo : function(userId, itemId, callback)
	{
		GradebookDWRFacade.getAttemptsInfo(parseInt(this.getCourseId(), 10), userId, itemId, callback);
	},

	setComments : function(userId, itemId, studentComments, instructorComments)
	{
		if ( this.studentComment == studentComments && this.instructorComment == instructorComments )
		{
			return;
		}
		GradebookDWRFacade.setComments(parseInt(this.getCourseId(), 10), userId, itemId, studentComments, instructorComments,
			this.studentComment != studentComments, this.instructorComment != instructorComments);
	},

	setExemption : function(callback, bookVersion, userId, itemId, exempt)
	{
		GradebookDWRFacade.setExemption(parseInt(this.getCourseId(), 10), parseInt(bookVersion, 10), parseInt(userId, 10), parseInt(itemId, 10), exempt, callback);
	},

	clearModifiedIndicator : function(itemId, userId)
	{
		GradebookDWRFacade.clearModifiedIndicator(parseInt(this.getCourseId(), 10), itemId, userId);
	},

	hideColumn : function(itemId)
	{
		GradebookDWRFacade.hideItem(parseInt(this.getCourseId(), 10), itemId, this.hideColumnCallBack.bind(this));
	},

	hideColumnCallBack : function()
	{
		GradebookGridUtil.reloadAndShowInlineReceipt(GradebookUtil.getMessage( 'hideColumnInlineMsg' ));
	},


	updateNumFrozenColumns : function(numFrozenColumns)
	{
		GradebookDWRFacade.updateNumFrozenColumns(parseInt(this.getCourseId(), 10), numFrozenColumns);
	},

	reloadGrid : function()
	{
		theGradeCenter.reloadGrid();
	},

	gotoURL : function(url)
	{
		window.location.href = url;
	},

	clearAttempts : function(colDefId, clearOption, startDate, endDate)
	{
		var frm = document.clearAttemptForm;
		frm.outcomeDefinitionId.value = colDefId;
		frm.clearOption.value = clearOption;
		frm.startDate.value = startDate;
		frm.endDate.value = endDate;
		frm.submit();
	},

	setDefaultView : function(view)
	{
		GradebookDWRFacade.setDefaultView(this.getCourseId(), view, this.setDefaultViewCallback.bind(this));
	},

	setDefaultViewCallback : function()
	{
		var cv = $("currentViewLabel").innerHTML;
		var msg = page.bundle.getString( "setAsDefaultMsg", cv );
		GradebookGridUtil.reloadAndShowInlineReceipt(msg);
	},

	updateUserVisibility : function(userId, visible)
	{
		GradebookDWRFacade.updateUserVisibility(parseInt(this.getCourseId(), 10), userId, visible, this.callbackReceipt.bind(this));
	},

	//data is the number of rows being updated
	//since another admin/instructor could delete a student from a course, we always refresh even though only visibility is changed
	callbackReceipt : function(data)
	{
		this.reloadGrid();
		var oneReceiptPerPage = false;
		// Adding a conditional text is not required as it would never be used as the function updateUserVisibility is
		// always called with visible=false.
		if ( $('receipt_id') )
		{
			oneReceiptPerPage = true;
		}
		new page.InlineConfirmation("success", GradebookUtil.getMessage( 'hideStudentInlineMsg' ), false, oneReceiptPerPage);
	},

	setColumnStudentVisibility : function(callback, columnId, visible)
	{
		GradebookDWRFacade.setColumnStudentVisibility(parseInt(this.getCourseId(), 10), columnId, visible, callback);
	},

	makeExternalGrade : function(itemId)
	{
		GradebookDWRFacade.updatePublicItemId(parseInt(this.getCourseId(), 10), itemId, (this.reloadGrid).bind(this));
	},

	getCourseId : function()
	{
		var crsId = this.courseId;
		if (crsId.indexOf("_") >= 0)
		{
			crsId = crsId.split("_")[1];
		}
		return crsId;
	}

};
// *********************************************************************
//************ Gradebook.CellController *******************************
//*********************************************************************

Gradebook.CellController = Class.create();

Gradebook.CellController.prototype =
{

	/* Controls all user interaction with an HTML table cell and its corresponding grid model cell including:
	 cell-type specific context menus
	 sorting by clicking on header cell
	 selecting a table cell
	 editing of cell value, which includes:
	 going into edit mode - showing an input text values to be entered
	 validating input as typed
	 listening for certain keys to submit or cancel editing
	 submitting changes to server and showing "Saving indicator"
	 check box in first column for selecting students
	 rendering of cell value and state indicators
	 grade comment & column into popups
	 */
	initialize : function(htmlCell, grid, row, column, isHeader, maxNumCol)
	{

		this.htmlCell = $(htmlCell);
		this.htmlCell.id = 'cell_' + row + '_' + column;
		this.htmlCell.controller = this;
		this.grid = grid;
		this.model = grid.model;
		this.row = row;
		this.col = column;
		this.isHeader = isHeader;
		Gradebook.CellController.tableId = this.grid.table.id;
		Gradebook.CellController.currentCell = this;
		var accessibleMode = this.grid.options.accessibleMode;
		this.isTopLeft = (this.row === 0 && this.col === 0) && isHeader;
		if (!accessibleMode)
		{
			this._nonAccessibleInit(maxNumCol);
		}

	},

	_nonAccessibleInit : function(maxNumCol)
	{
		// get elements in cell
		this.viewDiv = GradebookUtil.getChildElementByClassName(this.htmlCell, 'div', 'gbView');
		this.editDiv = GradebookUtil.getChildElementByClassName(this.htmlCell, 'div', 'gbEdit');
		this.editInput = GradebookUtil.getChildElementByClassName(this.htmlCell, 'input', 'editInput');
		this.textDiv = GradebookUtil.getChildElementByClassName(this.htmlCell, 'div', 'gbText');
		this.dataDiv = GradebookUtil.getChildElementByClassName(this.htmlCell, 'div', 'gbData');
		this.titleAnchor = GradebookUtil.getChildElementByClassName(this.htmlCell, 'a', 'titleAnchor');
		this.contextMenuAnchor = GradebookUtil.getChildElementByClassName(this.htmlCell, 'a', 'cmimg');
		this.checkInput = GradebookUtil.getChildElementByClassName(this.htmlCell, 'input', 'checkInput');

		if (this.isTopLeft)
		{
			Event.observe(this.checkInput, 'click', this.toggleSelection.bindAsEventListener(this));
			theGradeCenter.grid.checkAllCellController = this;
			return;
		}
		// add listeners to cell & anchors
		Event.observe(this.htmlCell, 'mouseover', this.onMouseOver.bindAsEventListener(this));
		Event.observe(this.htmlCell, 'mouseout', this.onMouseOut.bindAsEventListener(this));

		// add listeners to cell elements
		if (this.contextMenuAnchor)
		{
			var r = ( this.isHeader ) ? "h" : this.row;
			this.contextMenuAnchor.id = "cmlink_" + r + this.col;
			Event.observe( this.contextMenuAnchor, 'focus', this.insertContextMenu.bindAsEventListener( this, this.contextMenuAnchor ) );
			Event.observe( this.contextMenuAnchor, 'mouseover', this.insertContextMenu.bindAsEventListener( this, this.contextMenuAnchor ) );
		}

		if (this.row === 0 && this.col !== 0 && this.textDiv && this.dataDiv)
		{
			this.getGridCell = this.getHeaderGridCell;
			Event.observe(this.textDiv, 'click', this.onHeaderClicked.bindAsEventListener(this));
			Event.observe(this.dataDiv, 'focus', this.showHeaderInfoInTaskbar.bindAsEventListener(this));
			Event.observe(this.dataDiv, 'mouseover', this.showHeaderInfoInTaskbar.bindAsEventListener(this));
			Event.observe(this.dataDiv, 'mouseout', this.onHeaderMouseOut.bindAsEventListener(this));
			this.htmlCell.style.cursor = 'pointer';
			// we wire some listeners so that TAB shifts the content in the table
			if (this.contextMenuAnchor && (maxNumCol - 1) == this.col)
			{
				Event.observe(this.contextMenuAnchor, 'keydown', this.shiftOneColOnTAB.bindAsEventListener(this, false));
				this.observeAnchorTab = true;
			}
			if (this.grid.options.numFrozenColumns == (this.col - 1))
			{
				Event.observe(this.dataDiv, 'keydown', this.shiftOneColOnTAB.bindAsEventListener(this, true /* reverse */));
			}
		}
		else
		{
			this.getGridCell = this.getGradeGridCell;
			if (this.editInput)
			{
				Event.observe(this.editInput, 'keydown', this.onInputKeyDown.bindAsEventListener(this));
				Event.observe(this.editInput, 'keyup', this.onInputKeyUp.bindAsEventListener(this));
			}
			if (this.checkInput)
			{
				Event.observe(this.checkInput, 'click', this.onCheckBoxClicked.bindAsEventListener(this));
			}
			else
			{
				Event.observe(this.htmlCell, 'click', this.onClicked.bindAsEventListener(this));
			}
			if (this.titleAnchor)
			{
				Event.observe(this.titleAnchor, 'focus', this.onFocus.bindAsEventListener(this));
			}
		}
	},

	_accessibleInit : function()
	{
		if (this.isInitialized)
		{
			return;
		}
		this.isInitialized = true;
		// get elements in cell
		this.checkInput = this.htmlCell.down('input');
		this.titleAnchor = this.htmlCell.down('a');
		this.contextMenuAnchor = (this.titleAnchor) ? this.titleAnchor : this.htmlCell;

		if (this.isTopLeft)
		{
			Event.observe(this.checkInput, 'click', this.toggleSelection.bindAsEventListener(this));
			theGradeCenter.grid.checkAllCellController = this;
			return;
		}

		if (this.row === 0 && this.col !== 0)
		{
			this.dataDiv = this.titleAnchor;
			this.getGridCell = this.getHeaderGridCell;
			Event.observe(this.htmlCell, 'mouseover', this.showHeaderInfoInTaskbar.bindAsEventListener(this));
			Event.observe(this.htmlCell, 'mouseout', this.onHeaderMouseOut.bindAsEventListener(this));
		}
		else
		{
			this.getGridCell = this.getGradeGridCell;
		}

		if (this.checkInput)
		{
			Event.observe(this.checkInput, 'click', this.onCheckBoxClicked.bindAsEventListener(this));
		}
		else if (this.getGridCell().hasContextMenuInfo(this))
		{
			var r = (this.isHeader) ? "h" : this.row;
			this.contextMenuAnchor.id = "cmlink_" + r + this.col;
			Event.observe( this.contextMenuAnchor, 'focus', this.insertAccessibleContextMenu.bindAsEventListener( this ) );
			Event.observe( this.contextMenuAnchor, 'mouseover', this.insertAccessibleContextMenu.bindAsEventListener( this ) );
		}
		else
		{
			this.titleAnchor.addClassName("noMenu");
		}
		if (this.titleAnchor)
		{
			Event.observe(this.titleAnchor, 'focus', this.onFocus.bindAsEventListener(this));
		}
	},

	isHeaderCell: function()
	{
		return this.isHeader;
	},

	unload: function()
	{
		this.grid = null;
		this.htmlCell.controller = null;
		this.htmlCell = null;
		this.grid = null;
		this.viewDiv = null;
		this.editDiv = null;
		this.editInput = null;
		this.textDiv = null;
		this.dataDiv = null;
		this.titleAnchor = null;
		this.contextMenuAnchor = null;
		this.checkInput = null;
		this.getGridCell = null;
		this.editGridCell = null;
	},

	getUserId : function()
	{
		return this.getGridCell().getUserId();
	},

	getColDefId : function()
	{
		return this.getGridCell().colDef.id;
	},

	//************ checkbox logic *******************************

	onCheckBoxClicked : function(evt)
	{
		var gridcell = this.getGridCell();
		gridcell.setRowChecked(this.checkInput.checked);
		var userId = gridcell.userId;
		if (this.checkInput.checked)
		{
			if (evt.shiftKey && Gradebook.CellController.prototype.lastCheckedUserId)
			{
				this.model.checkedRangeOfStudents(gridcell.userId, Gradebook.CellController.prototype.lastCheckedUserId);
			}
			Gradebook.CellController.prototype.lastCheckedUserId = gridcell.userId;
		}
		else
		{
			Gradebook.CellController.prototype.lastCheckedUserId = null;
		}
		// don't invoke Event.stop here because that in turn calls preventDefault, which prevents the checkbox from toggling 
		evt.stopPropagation();
		evt.stopped = true;
	},

	toggleSelection : function()
	{
		if (this.checkInput.checked)
		{
			this.onSelectAllStudents();
		}
		else
		{
			this.onSelectNoStudents();
		}
	},

	onSelectAllStudents : function(evt)
	{
		this.model.checkedAllStudents();
	},

	onSelectNoStudents : function(evt)
	{
		this.model.checkedNoStudents();
	},

	onSelectInvertStudents : function(evt)
	{
		this.model.invertCheckedStudents();
	},

	onSortCheckedStudents : function(evt)
	{
		// always show checked students at top
		this.grid.sortColumn(this, 'DESC');
	},


	//************ sort logic *******************************

	onHeaderClicked: function(evt)
	{
		/*
		 * AS-152336 sorting causes incorrect values because edited cell was not
		 * released before the sort operation.  Sorting would change the locations
		 * of cells except for the one still pinned by the edit state.  unselectCurrentCell
		 * can save edit and argument doNotClearStatusBar is true to display status for
		 * the column header that was clicked.
		 */
		this.unselectCurrentCell(true);

		this.grid.sortColumn(this);
	},

	setSortImage: function(dir)
	{
		this.htmlCell.removeClassName('sortedUp');
		this.htmlCell.removeClassName('sortedDown');
		if ( dir == 'ASC' )
		{
			this.htmlCell.addClassName('sortedUp');
		}
		else if ( dir == 'DESC' )
		{
			this.htmlCell.addClassName('sortedDown');
		}
	},

	onSortAscending: function(dir)
	{
		this.unselectCurrentCell(true);  //AS-152336 see above
		this.grid.sortColumn(this,'ASC');
	},

	onSortDescending: function(dir)
	{
		this.unselectCurrentCell(true);  //AS-152336 see above
		this.grid.sortColumn(this,'DESC');
	},

	//************ select cell logic *******************************

	onFocus: function( evt )
	{
		document.ignoreOnClick = true; //IE7 issue where focus is followed by on click on the document - AS-123689
		window.setTimeout( "document.ignoreOnClick = false", 2000 );
		this.onClicked( evt );
	},

	onClicked: function(evt)
	{
		var eventTarget = evt.target ? evt.target : evt.srcElement;
		if ($(eventTarget).hasClassName('cmimg') || $(eventTarget.parentNode).hasClassName('cmimg'))
		{
			if (evt)
			{
				Event.stop( evt );
			}
			return;
		}
		Gradebook.CellController.prototype.lastEventTarget = eventTarget;
		this.selectCell( eventTarget );
		if (evt)
		{
			Event.stop( evt );
		}
	},

	isSelected: function()
	{
		return (Gradebook.CellController.currentSelectedCell == this.htmlCell);
	},

	selectCell: function( optionalEventTarget )
	{
		Gradebook.CellController.prototype.tableHasFocus = true;
		if ( this.isSelected() || this.checkInput )
		{
			return;
		}
		this.closePopups();
		this.unselectCurrentCell( true /*do not clear status bar */ );
		var gridCell = this.getGridCell();
		Gradebook.CellController.currentSelectedCell = this.htmlCell;
		var hascm = this.hasContextMenu();
		Element.addClassName(this.htmlCell, hascm?"cellClick":"cellClickNoCM");
		Element.addClassName(this.htmlCell.parentNode, "focusRowHigh");
		var headerTable = $(Gradebook.CellController.tableId + '_header');
		if (headerTable)
		{
			Element.addClassName(headerTable.rows[0].cells[this.col],"focusHeader");
		}
		if (!this.isEditing && this.titleAnchor)
		{
			// no need to put focus on the anchor if it is already the active element
			if ( !optionalEventTarget || ( optionalEventTarget != this.titleAnchor ) )
			{
				this.titleAnchor.focus();
			}
		}
		else if ( this.grid.options.accessibleMode )
		{
			this.htmlCell.focus();
		}
		this.setTaskbarInfo(gridCell);
		if (!this.grid.options.accessibleMode)
		{
			this.startEdit();
		}
	},

	showHeaderInfoInTaskbar: function()
	{
		var colDef = this.getGridCell().getColumnDefinition();
		if ( colDef.getType() == "student" )
		{
			theGradeCenter.setMsgInTaskBar( colDef.getName() );
		}
		else
		{
			theGradeCenter.setHeaderInfoInTaskBar( colDef );
		}
	},

	setTaskbarInfo : function(gridCell)
	{
		if (!gridCell)
		{
			theGradeCenter.clearTaskBar();
		}
		else if (gridCell.isGrade())
		{
			var colDef = gridCell.colDef;
			var gradeType = '&nbsp;';
			var pointsPossible = '&nbsp;';
			var primaryDisplay = '&nbsp;';
			var visibileToStudents = '&nbsp;';
			try
			{
				if (gridCell.canEdit())
				{
					gradeType = GradebookUtil.getMessage((gridCell.isOverride()) ? 'overrideGradeMsg' : 'gradeMsg');
				}
				else
				{
					gradeType = GradebookUtil.getMessage(colDef.getType() + 'Msg');
				}
				primaryDisplay = colDef.primarySchema.name;
				var maxPrecision = ( gridCell.colDef.isCalculated()?2:5 );
				if ( 2 == maxPrecision )
				{
					pointsPossible = parent.NumberFormatter.getDisplayFloat( parseFloat(gridCell.getPointsPossible()).toFixed(2) );
				}
				else
				{
					pointsPossible = parent.NumberFormatter.toStringMin2Digits( parseFloat( gridCell.getPointsPossible() ), maxPrecision );
				}
				visibileToStudents = GradebookUtil.getMessage((colDef.vis) ? 'isMsg' : 'isNotMsg');
			}
			catch (ignore)
			{
			}
			theGradeCenter.setTaskBar(gradeType, pointsPossible, primaryDisplay, visibileToStudents);
		}
		else
		{
			theGradeCenter.setTaskBar();
		}
	},

	unselectCell: function( doNotClearStatusBar )
	{
		Element.removeClassName(this.htmlCell, "cellClick");
		Element.removeClassName(this.htmlCell, "cellClickNoCM");
		Element.removeClassName(this.htmlCell.parentNode, "focusRowHigh");
		var headerTable = $(Gradebook.CellController.tableId + '_header');
		if (headerTable)
		{
			Element.removeClassName(headerTable.rows[0].cells[this.htmlCell.cellIndex],"focusHeader");
		}
		if ( !doNotClearStatusBar )
		{
			this.setTaskbarInfo();
		}
	},

	unselectCurrentCell: function( doNotClearStatusBar )
	{
		var cell = Gradebook.CellController.currentSelectedCell;
		if (cell)
		{
			var done = false;
			var commit = false;
			var cellController = cell.controller;
			if ( cellController)
			{
				if ( cellController.hasUncommittedChanges())
				{
					var validationError = cellController.editGridCell.validate(cellController.editInput.value);
					if (!validationError)
					{
						commit = confirm(GradebookUtil.getMessage('uncommitedchangeErrorMsg'));
					}
					else
					{
						alert(GradebookUtil.getMessage('uncommitedchangeNotSavedErrorMsg'));
					}
				}
				done = cellController.stopEdit(commit, true /* no focus on the cell we are exiting */);
				if(done)
				{
					cellController.unselectCell( doNotClearStatusBar );
				}
			}
			if(done)
			{
				Gradebook.CellController.currentSelectedCell = null;
			}
			return done;
		}
		return true;
	},

	//************ edit grade logic *******************************

	startEdit: function()
	{
		try
		{
			this.editGridCell = this.getGridCell();
			if (!this.editGridCell.canEdit()  ||
				this.editGridCell.isExempt() /* one must clear the exemption before to be able to input a grade */ ||
				!this.isSelected() || !this.editInput )
			{
				return;
			}
			this.isEditing = true;
			this.editInput.value = this.editGridCell.getEditValue();
			this.viewDiv.style.display = "none";
			this.editDiv.style.display = "block";
			this.editInput.focus();
			this.editInput.select();
		}
		catch ( ignore ) { }
	},

	onInputKeyDown: function(evt)
	{
		if ( evt && evt.keyCode == Event.KEY_TAB )
		{
			this.stopEdit(true, false); //commit, Set Focus back to cell content
			Event.stop( evt );
		}
	},

	onInputKeyUp: function(evt)
	{
		Event.stop( evt );
		switch (evt.keyCode)
		{
			case (Event.KEY_UP):
			case (Event.KEY_DOWN):
			case (Event.KEY_LEFT):
			case (Event.KEY_RIGHT):
				evt.cancelBubble = false; // allow event to bubble so attempted navigation will occur
				break;
			case (Event.KEY_RETURN):
				try
				{
					Gradebook.noResize = true; /*IEHack*/
					var editDone = this.stopEdit(true /*commit*/, false /*keep focus on cell we exit*/, true /* - while Needs Grading are considered change */);
					if ( editDone )
					{
						// select cell below
						this.grid.selectRelativeCell(1, 0);
					}
				}
				finally
				{
					Gradebook.noResize = false;
				}
				break;
			case (Event.KEY_ESC):
				this.stopEdit(false); // don't commit
				break;
			default:
				var validationError = this.editGridCell.validate( this.editInput.value, true ); // match partial
				if (validationError)
				{
					this.showValidationError(validationError);
				}
				else
				{
					this.hideValidationError();
				}
		}
	},

	shiftOneColOnTAB: function( evt, reverse )
	{
		if ( Event.KEY_TAB != evt.keyCode )
		{
			return;
		}
		if ( evt.shiftKey && reverse)
		{
			if ( this.grid.viewPort.scrollCols( -1 ) )
			{
				if (evt)
				{
					Event.stop( evt );
				}
				this.dataDiv.focus();
			}
		}
		else if ( !evt.shiftKey && !reverse )
		{
			if ( this.grid.viewPort.scrollCols( 1 ) )
			{
				if (evt)
				{
					Event.stop( evt );
				}
				this.dataDiv.focus();
			}
		}
	},

	// returns false if validation error occurs when committing
	stopEdit: function(commit, doNotSetFocus, doNotIgnoreDash)
	{
		if (!this.isEditing)
		{
			return true;
		}
		var currentCell = this.editGridCell;
		// if the user press Return and the grade is a -, and it was a - before but obfuscated by a status indicator
		// then trigger the null mechanism; - is only accounted for Return, not when cell loses focus due to other reasons
		if (commit &&
			( this.hasUncommittedChanges() ||
			( doNotIgnoreDash && ( currentCell.needsGrading() || currentCell.attemptInProgress() ) ) ) )
		{
			var inputVal = this.editInput.value;
			var validationError = currentCell.validate( inputVal );
			if (validationError)
			{
				this.showValidationError(validationError);
				this.editInput.select();
				this.editInput.focus();
				return false;
			}
			var save = true;
			if ( !inputVal )
			{
				inputVal = '-';
			}
			// confirm if OK to delete or null grade
			if (inputVal == '-')
			{
				if ( currentCell.getValue() == '-' && !currentCell.hasAttempts() )
				{
					save = false;
				}
				else
				{
					if ( currentCell.isOverride() )
					{
						if ( !currentCell.hasAttempts() )
						{
							save = confirm( GradebookUtil.getMessage( 'confirmRevertMsg' ) );
						}
						else
						{
							this.showRevertWithAttemptsConfirmation( doNotSetFocus );
							return false;
						}
					}
					else if ( currentCell.hasMultipleAttempts() )
					{
						this.showMultipleAttemptsNullConfirmation( doNotSetFocus );
						return false;
					}
					else
					{
						if ( !this.editGridCell.colDef.isAttemptWithPayload( ) )
						{
							// There is no data behind that attempt, so not an issue if it is deleted
							save = confirm(GradebookUtil.getMessage( 'confirmNullMsg' ));
						}
						else
						{
							// here this a real attempt, so we need to prompt the user what do with it, delete or revert to needs grading?
							this.showSingleAttemptNullConfirmation( doNotSetFocus );
							return false;
						}
					}
				}
			}
			if (save)
			{
				// send update to server
				this.editGridCell.update(inputVal);

				// morph on timestamp on grade information bar
				this.afterSavingItem();
			}
		}
		this.returnCellToNotEdit( doNotSetFocus );
		return true;
	},

	returnCellToNotEdit: function( doNotSetFocus )
	{
		this.hideValidationError();
		this.isEditing = false;
		this.editGridCell = null;
		this.viewDiv.style.display = "block";
		if (!doNotSetFocus)
		{
			this.titleAnchor.focus();
		}
		this.editDiv.style.display = "none";
	},

	showRevertWithAttemptsConfirmation : function(doNotSetFocus)
	{
		var revertToNeedsGradingEl = $('revertAndNeedsGradingEl');
		if ( !this.editGridCell.colDef.isAttemptWithPayload() || !this.editGridCell.colDef.isAllowAttemptGrading() )
		{
			// Manual Columns/Activity do not have attempt data, so it does not make sense to transition to needs grading
			// Columns that do not allow attempt grading cannot allow to change an attempt grade to needs grading
			revertToNeedsGradingEl.hide();
			$('revertAndNeedsGrading').name = 'xxxxxx'; // fix KB navigation using arrows
		                                                // to move up/down the choices
		}
		else
		{
			revertToNeedsGradingEl.show();
			$('revertAndNeedsGrading').name = 'revertWithAttemptChoice';
		}
		var firstRadio = $('revertOnly');
		firstRadio.checked = true;
		GradebookGridUtil.showAlertLightbox( 'revertWithAttemptsConfirm', window.gridMessages.confirmRevertLBTitle, firstRadio );
		Gradebook.CellController.currentCell = this;
		$('revertWithAttemptsConfirmCancel').onclick = function()
		{
			Gradebook.CellController.currentCell.closeAlertLightbox(doNotSetFocus);
			return false;
		};
		doubleSubmit.registerFormSubmitEvents( $('revertWithAttemptsConfirmForm'), function(){
			try
			{
				if ($('revertOnly').checked)
				{
					Gradebook.CellController.currentCell.editGridCell.update('-');
				}
				else if ($('revertAndNeedsGrading').checked)
				{
					Gradebook.CellController.currentCell.editGridCell.clearAll(false);
				}
				else if ($('revertAndDelete').checked)
				{
					if (confirm(window.gridMessages.confirmDeleteOnRevert))
					{
						Gradebook.CellController.currentCell.editGridCell.clearAll(true);
					}
				}
				// morph on timestamp on grade information bar
				Gradebook.CellController.currentCell.afterSavingItem();
			}
			catch( e )
			{
				// we must always return false to prevent the form to ever submit
				alert( e );
			}
			Gradebook.CellController.currentCell.closeAlertLightbox(doNotSetFocus);
			return false;
		});
	},

	showMultipleAttemptsNullConfirmation: function( doNotSetFocus )
	{
		var allowToNeedsGrading  = !this.editGridCell.colDef.isManual() && this.editGridCell.colDef.isAllowAttemptGrading();
		if ( !allowToNeedsGrading )
		{
			// the only option in that case is to delete the attempts
			$('multipleAttemptsModeSelection').hide( );
			$('multipleAttemptsConfirmDeletion').show( );
		}
		else
		{
			$('multipleAttemptsConfirmDeletion').hide( );
			$('multipleAttemptsModeSelection').show( );
		}
		var templateForAttemptEl = $('attemptChoicesTemplate');
		if ( !templateForAttemptEl )
		{
			alert( 'could not find template' );
		}
		templateForAttemptEl.hide();
		var templateForAttempt = templateForAttemptEl.down('ol').innerHTML;
		var attemptsContainer = $('attemptChoices').down('ol');
		attemptsContainer.innerHTML = '';
		attemptsContainer.forGrade = this.editGridCell.getKey();
		this.editGridCell.loadAttemptsInfo( function( cell )
		{
			// 1st since this is asynchronous let's make sure the displayed
			// lightbox is still for the grade we just got the attempts for
			if ( cell.getKey() != attemptsContainer.forGrade )
			{
				return;
			}
			var innerHtml = '';
			cell.data.attemptsInfo.each( function( attemptInfo ) {
				var checkboxHtml = templateForAttempt;
				checkboxHtml = checkboxHtml.replace( 'ATTEMPT_ID', attemptInfo.id );
				checkboxHtml = checkboxHtml.replace( 'ATTEMPT_ID_NAME', attemptInfo.getText() );
				checkboxHtml = checkboxHtml.replace( /attemptsToClearTEMPLATE/g, 'attemptsToClear' );
				checkboxHtml = checkboxHtml.replace( /attemptsToClearIDTEMPLATE/g, 'att_' + attemptInfo.id );
				innerHtml += checkboxHtml;
			} );
			attemptsContainer.innerHTML = innerHtml;
			GradebookGridUtil.resizeLightbox( 'multipleAttemptsNullGradeConfirm' );
		} );
		$('multipleAttemptsAll').checked=true;
		var synCheckboxesDisabledState = function()
		{
			var disabled = !$('multipleAttemptsSelected').checked;
			var attemptsCB = $('multipleAttemptsNullGradeConfirmForm').getInputs( 'checkbox', 'attemptsToClear' );
			attemptsCB.each( function( cb ) { cb.disabled = disabled; } );
		};
		$('multipleAttemptsAll').onclick = synCheckboxesDisabledState;
		$('multipleAttemptsSelected').onclick = synCheckboxesDisabledState;
		var submitButton = $('multipleAttemptsNullGradeConfirmSubmit');
		var firstElement = allowToNeedsGrading?$('multipleAttemptsNeedsGrading'):$('multipleAttemptsDeleteCB');
		firstElement.checked = allowToNeedsGrading;
		GradebookGridUtil.showAlertLightbox( 'multipleAttemptsNullGradeConfirm', window.gridMessages.confirmRevertLBTitle, firstElement );
		Gradebook.CellController.currentCell = this;
		$('multipleAttemptsNullGradeConfirmCancel').onclick = function()
		{
			Gradebook.CellController.currentCell.closeAlertLightbox( doNotSetFocus );
			return false;
		};
		doubleSubmit.registerFormSubmitEvents( $('multipleAttemptsNullGradeConfirmForm'), function(){
			try
			{
				var isAllAttempt, attemptIds;
				var form = $('multipleAttemptsNullGradeConfirmForm');
				if ( $('multipleAttemptsSelected').checked )
				{
					attemptIds = [];
					var attemptsCB = form.getInputs( 'checkbox', 'attemptsToClear' );
					attemptsCB.each( function( cb ) { if ( cb.checked )  {attemptIds.push( cb.value ); } } );
				}
				else
				{
					isAllAttempt = (  $('multipleAttemptsAll').checked );
				}
				if ( allowToNeedsGrading && $( 'multipleAttemptsNeedsGrading').checked )
				{
					if ( isAllAttempt )
					{
						Gradebook.CellController.currentCell.editGridCell.clearAll( false );
					}
					else if ( attemptIds && attemptIds.size() > 0 )
					{
						Gradebook.CellController.currentCell.editGridCell.clearSelected( attemptIds, false );
					}
				}
				else if ( ( allowToNeedsGrading  && $( 'multipleAttemptsDelete').checked     ) ||
					( !allowToNeedsGrading && $( 'multipleAttemptsDeleteCB' ).checked  ) )
				{
					if ( isAllAttempt )
					{
						if ( confirm( window.gridMessages.confirmDeleteOnRevert ) )
						{
							Gradebook.CellController.currentCell.editGridCell.clearAll( true );
						}
					}
					else if ( attemptIds && attemptIds.size() > 0 )
					{
						if ( confirm( window.gridMessages.confirmDeleteSelected ) )
						{
							Gradebook.CellController.currentCell.editGridCell.clearSelected( attemptIds, true );
						}
					}
				}
			}
			catch ( e )
			{
				// we must always return false to prevent the form to ever submit
				alert( e );
			}
			Gradebook.CellController.currentCell.closeAlertLightbox( doNotSetFocus );
			return false;
		});
	},

	showSingleAttemptNullConfirmation: function( doNotSetFocus )
	{
		var allowToNeedsGrading = this.editGridCell.colDef.isAllowAttemptGrading();
		var flyoutFormId = allowToNeedsGrading?'singleAttemptNullGradeConfirm':'singleAttemptDeleteConfirm';
		var firstElement = allowToNeedsGrading?$('singleAttemptNeedsGrading'):$('singleAttemptDeleteCB');
		firstElement.checked = allowToNeedsGrading;
		GradebookGridUtil.showAlertLightbox( flyoutFormId, window.gridMessages[ allowToNeedsGrading?'confirmSingleAttemptLB':'confirmDeleteSingleAttemptLB' ], firstElement );
		Gradebook.CellController.currentCell = this;
		$( flyoutFormId + 'Cancel').onclick = function()
		{
			Gradebook.CellController.currentCell.closeAlertLightbox( doNotSetFocus );
			return false;
		};
		doubleSubmit.registerFormSubmitEvents( $( flyoutFormId + 'Form'), function(){
			try
			{
				if ( allowToNeedsGrading )
				{
					if ( $('singleAttemptNeedsGrading').checked)
					{
						Gradebook.CellController.currentCell.editGridCell.clearAll(false);
						Gradebook.CellController.currentCell.afterSavingItem();
					}
					else if ( ( $('singleAttemptDelete').checked ) )
					{
						if (confirm(window.gridMessages.confirmDeleteOnRevert))
						{
							Gradebook.CellController.currentCell.editGridCell.clearAll(true);
							Gradebook.CellController.currentCell.afterSavingItem();
						}
					}
				}
				else if ( $('singleAttemptDeleteCB').checked )
				{
					if (confirm(window.gridMessages.confirmDeleteOnRevert))
					{
						Gradebook.CellController.currentCell.editGridCell.clearAll(true);
						Gradebook.CellController.currentCell.afterSavingItem();
					}
				}
			}
			catch( e )
			{
				// we must always return false to prevent the form to ever submit
				alert( e );
			}
			Gradebook.CellController.currentCell.closeAlertLightbox(this.doNotSetFocus);
			return false;
		});
	},

	closeAlertLightbox: function( doNotSetFocus )
	{
		this.returnCellToNotEdit( doNotSetFocus );
		this.grid.selectRelativeCell(1, 0);
		Gradebook.alertLightbox.close();
		Gradebook.alertLightbox = null;
	},

	hasUncommittedChanges: function(evt)
	{
		if( this.isEditing )
		{
			if( !this.editGridCell.isGraded() && this.editGridCell.needsGrading() )
			{
				return this.editInput.value !== ""; //if the cell is 'needs grading' and doesn't have any graded attempt, we must make sure the editted input is not empty. otherwise, it means the user just clicked on a needs grading cell and then moved away so no action needs to be taken
			}
			else
			{
				return this.editInput.value != this.editGridCell.getEditValue();
			}
		}
		return false;
	},

	//************ rendering logic *******************************

	previousElementSibling: function(node)
	{
		node = node.previousSibling;
		while ( node  )
		{
			if (node.nodeType == 1)
			{
				return node;
			}
			node = node.previousSibling;
		}
		return null;
	},

	renderHTML : function(dataCell)
	{
		var anchorVal;
		var altVal;
		if (!this.gridCell)
		{
			this.gridCell = new parent.Gradebook.GridCell();
			if (!this.grid.options.accessibleMode && this.col == 1)
			{
				// checkbox column shares grid controller with first cell, this allows
				// access
				// to metadata for select row functionality
				this.previousElementSibling(this.htmlCell).controller.gridCell = this.gridCell;
			}
		}
		var gridCell = this.gridCell;
		gridCell.setData(dataCell);
		var cellValue = gridCell.getCellValue();
		if (this.grid.options.accessibleMode)
		{
			this._accessibleInit();
		}
		this.htmlCell.className = this.grid.model.getColorScheme( gridCell );

		if (gridCell.isExcluded())
		{
			anchorVal = window.gridImages.excludedGrade;
		}
		else if (gridCell.isExempt())
		{
			anchorVal = window.gridImages.exemptGrade;
			altVal = gridCell.getAltValue();
		}
		else if ( gridCell.isOverride() )
		{
			anchorVal = cellValue;
			altVal =  gridCell.getAltValue();
			if ( gridCell.needsGrading() && gridCell.isOverrideBeforeNeedsGrading( ) )
			{
				anchorVal = anchorVal + '&nbsp;'+ window.gridImages.needsGrading;
			}
		}
		else if ( gridCell.needsGrading() )
		{
			anchorVal = window.gridImages.needsGrading;
			if ( gridCell.isGraded() )
			{
				anchorVal = cellValue + '&nbsp;'+ anchorVal;
			}
			altVal = gridCell.getAltValue();
		}
		else if ( gridCell.attemptInProgress() )
		{
			anchorVal = window.gridImages.attemptInProgress;
			if ( gridCell.isGraded() )
			{
				anchorVal = cellValue + '&nbsp;'+ anchorVal;
			}
		}
		else if (gridCell.isComplete())
		{
			anchorVal = cellValue;
			altVal = GradebookUtil.getMessage('completedMsg');
		}
		else if ( gridCell.isGrade() && !gridCell.isGraded())
		{
			anchorVal = window.gridImages.noGrade;
			altVal = gridCell.getAltValue();
		}
		else
		{
			anchorVal = cellValue;
			altVal = gridCell.getAltValue();
		}
		if ( anchorVal !== null )
		{
			if (this.col == 1 && !gridCell.isAvailable())
			{
				anchorVal = window.gridImages.studentUnavailable + " " + anchorVal;
			}
			if (gridCell.isOverride() )
			{
				anchorVal = window.gridImages.gradeOverride + " " + anchorVal;
			}
			if (anchorVal.blank && anchorVal.blank())
			{
				anchorVal = '&nbsp;';
			}
			if (this.titleAnchor)
			{
				this.titleAnchor.innerHTML = anchorVal;
				this.titleAnchor.title = altVal;
			}
		}
	},

	renderHeaderCellHTML: function( colDef )
	{
		if (this.grid.options.accessibleMode)
		{
			this._accessibleInit();
		}
		var anchorVal = '';
		var title = colDef.name.unescapeHTML();
		// IE hack so that unicode are properly escaped
		this.dataDiv.innerHTML = title;
		this.dataDiv.title = title;
		if (!colDef.isVisibleToStudents())
		{
			anchorVal += window.gridImages.itemNotVisible;
		}
		if (colDef.isPublic())
		{
			anchorVal += window.gridImages.externalGrade;
		}
		if (colDef.hasError())
		{
			anchorVal += window.gridImages.gradingError;
		}
		anchorVal += title;
		this.dataDiv.innerHTML = anchorVal;
	},

	afterSavingItem: function()
	{
		var timeStampDiv = $("timeStampDiv");
		var flashingColor = "color:#000;background:#fff";
		var backgroundColor = "color: #000; background: #FFCC66";
		if ( timeStampDiv )
		{
			timeStampDiv.morph( backgroundColor );
			setTimeout("$('timeStampDiv').morph('"+flashingColor+"')", 1000);
		}
	},

	showValidationError: function(error)
	{
		var errDiv = $("errorDiv");
		var p = errDiv.down('p.errorDiv2');
		p.innerHTML = error;
		errDiv.style.display = "block";
		var pos = GradebookUtil._toAbsolute(this.htmlCell, false, errDiv.offsetParent );
		errDiv.style.top = pos.y + this.htmlCell.offsetHeight + "px";
		errDiv.style.left = pos.x -1 + "px";
		Element.addClassName(this.htmlCell, "cellError");
	},

	hideValidationError: function()
	{
		var errDiv = $("errorDiv");
		errDiv.style.display = "none";
		Element.removeClassName(this.htmlCell, "cellError");
	},

	hasContextMenu: function()
	{
		if ( this.col === 0 )
		{
			return false;
		}
		else
		{
			return (this.getGridCell().hasContextMenuInfo(this) );
		}
	},

	onMouseOver: function(evt)
	{
		if (!this.htmlCell || this.htmlCell.className == "cellClick")
		{
			return;
		}
		var hascm = this.hasContextMenu();
		Element.addClassName(this.htmlCell, hascm?"cellhigh":"cellhighNoCM");
		var rowElement = this.htmlCell.parentNode;
		if (rowElement.className != "focusRowHigh")
		{
			Element.addClassName(rowElement, "rowhigh");
		}
	},

	onMouseOut: function(evt)
	{
		if (!this.htmlCell || this.htmlCell.className == "cellClick")
		{
			return;
		}
		Element.removeClassName(this.htmlCell, "cellhigh");
		Element.removeClassName(this.htmlCell, "cellhighNoCM");
		var rowElement = this.htmlCell.parentNode;
		if (rowElement.className != "focusRowHigh")
		{
			Element.removeClassName(rowElement, "rowhigh");
		}
	},

	onHeaderMouseOut: function( evt )
	{
		if ( Gradebook.CellController.currentSelectedCell )
		{
			var selectedCell = Gradebook.CellController.currentSelectedCell.controller;
			selectedCell.setTaskbarInfo( selectedCell.getGridCell() );
		}
		else
		{
			theGradeCenter.clearTaskBar();
		}
	},


	//************ context menu logic *******************************

	insertContextMenu: function()
	{
		// clone template to create a new context menu
		var cm = theGradeCenter.contextMenuTemplate.cloneNode(true);

		// create & set a new unique id
		var uniqueId = cm.down("a").id.split('_')[1];
		var newId = this.contextMenuAnchor.id.split('_')[1];
		cm.update( cm.innerHTML.gsub(uniqueId, newId) );

		// doNotSetFocusOnClose is used in page.ContextMenu.onCloseLinkClick to determine if focus
		// should be set to the contextMenuAnchor after the menu is closed. In non-accesible mode, we
		// do not want to set focus to the contextMenuAnchor because it is made invisible onMouseOut
		cm.down( 'a.cmimg' ).doNotSetFocusOnClose = !this.grid.options.accessibleMode;

		// create context menu controller
		var cmCtrl = new page.ContextMenu( cm, cm.down("div").id );
		cmCtrl.cellController = this;
		this.contextMenuController = cmCtrl;

		// add context menu to table cell, remove existing link
		var link = this.contextMenuAnchor;
		$(this.htmlCell).down('div').appendChild( cm );
		link.stopObserving();
		link.up('div').remove();
		if (this.observeAnchorTab)
		{
			Event.observe(cmCtrl.displayContextMenuLink, 'keydown', this.shiftOneColOnTAB.bindAsEventListener(this, false));
		}
	},

	insertAccessibleContextMenu: function( event )
	{
		if ( this.htmlCell.hasContextMenu )
		{
			return;
		}
		this.htmlCell.hasContextMenu = true;
		// clone template to create a new context menu
		var cm = theGradeCenter.contextMenuTemplate.cloneNode(true);
		var cma = cm.down("a");
		var link = this.contextMenuAnchor;

		// create & set a new unique id
		var uniqueId = cma.id.split('_')[1];
		var newId = uniqueId + "_" + this.row + "_" + this.col;
		cm.update( cm.innerHTML.gsub(uniqueId, newId) );
		cma.update( link.innerHTML );
		var txt = link.innerHTML;

		// add context menu to table cell
		$(this.htmlCell).appendChild( cm );

		link.stopObserving();
		link.remove();
		cma = cm.down("a");
		cma.className = "";
		cma.update( txt );
		this.titleAnchor = this.htmlCell.down('a');
		this.contextMenuAnchor = (this.titleAnchor) ? this.titleAnchor : this.htmlCell;

		// create context menu controller
		var cmCtrl = new page.ContextMenu( cm, cm.down("div").id );
		Event.observe( this.contextMenuAnchor, 'focus', this.onFocus.bindAsEventListener( this ) );
		cmCtrl.cellController = this;
		this.contextMenuController = cmCtrl;

		if ( event && event.type == "focus" && event.target == link )
		{
			cma.focus();
		}
	},

	getContextMenuItems: function()
	{
		var isGrade = this.getGridCell().isGrade();
		if ( this.isHeader )
		{
			if ( isGrade )
			{
				return this.getGradeColDefContextMenuItems();
			}
			else
			{
				return this.getStudentAttributeColDefContextMenuItems();
			}
		}
		else
		{
			if ( isGrade )
			{
				return this.getGradeContextMenuItems();
			}
			else
			{
				return this.getStudentContextMenuItems();
			}
		}
	},

	getStudentAttributeColDefContextMenuItems : function()
	{
		var colDef = this.getGridCell().getColumnDefinition();
		var items = [];
		items.push( { key : "cmSortAscendingMsg", onclick : this.onSortAscending.bindAsEventListener(this) } );
		items.push( { key : "cmSortDescendingMsg", onclick : this.onSortDescending.bindAsEventListener(this) } );
		if ( colDef.canHide() )
		{
			items.push( { key : "cmHideItemMsg", onclick : this.onHideColumn.bindAsEventListener(this) } );
		}

		return items;
	},

	getGradeColDefContextMenuItems : function()
	{
		var colDef = this.getGridCell().getColumnDefinition();
		var scoreProvider = colDef.getScoreProvider();
		var items = [];
		items.push( { key : "cmViewInfoMsg", onclick : this.onViewColumnInfo.bindAsEventListener(this) } );
		if (scoreProvider && scoreProvider.allowContentEdit )
		{
			var msg = page.bundle.getString( "cmModifyContentMsg", scoreProvider.typeName );
			items.push( { name : msg, onclick : this.onEditContent.bindAsEventListener(this) } );
		}

		if (colDef.isAlignable() && window.bbalign )
		{
			items.push( { key : "cmViewAlignmentsMsg", onclick : this.onShowAlignments.bindAsEventListener(this) } );
		}

		this.appendSeperator( items );

		if (scoreProvider && scoreProvider.attemptBased )
		{
			if ( colDef.supportsMenuItem( "cmGradeAttempts" ) )
			{
				items.push( { key : "cmGradeAttempts", onclick : this.onGradeAttempts.bindAsEventListener(this) } );
			}

			if ( colDef.supportsMenuItem( "cmGradeAnonymously" ) )
			{
				items.push( { key : "cmGradeAnonymously", onclick : this.onGradeAnonymously.bindAsEventListener(this) } );
			}
		}
		var actions = scoreProvider ? scoreProvider.actions : null;
		if (actions)
		{
			var onClickFunction = function(url) {
				var gcFrame = (top.content.gradecenterframe) ? top.content.gradecenterframe : top.content;
				gcFrame.location.href = url;
			};

			for (var i = 0; i < actions.length; i++)
			{
				var action = actions[i];
				if (action.controller && action.controller.isEnabled( colDef ) === false)
				{
					continue;
				}
				var url = action.actionUrl + "?outcome_definition_id=" + colDef.id + "&course_id=" + colDef.model.courseId;
				if ( colDef.supportsMenuItem( action.internalName ) )
				{
					items.push( { name : action.name, onclick : onClickFunction.bind(colDef, url) } );
				}
			}
		}
		if (colDef.hasRubricAssociations())
		{
			var onRubricClickFunction = function(url) {
				var gcFrame = (top.content.gradecenterframe) ? top.content.gradecenterframe : top.content;
				gcFrame.location.href = url;
			};
			var rubricIds = colDef.getRubricIds();
			for (var i=0; i< rubricIds.length; i++)
			{
				var url = "/webapps/blackboard/execute/reporting/runReport?hideList=true&report_def_id=@X@reportDefinition.id@X@&nav_bridge=cp_gradebook2_rubric_associations_report&report_type=learn.course.gradecenter.column.stats&course_id=" +
					colDef.model.courseId + "&gradebook_main_pk1=_" + colDef.id + "_1&rubric_id=" + rubricIds[i].id + "&qti_asi_data_pk1=";

				items.push( { name : rubricIds[i].name, onclick : onRubricClickFunction.bind(colDef, url) } );
			}
		}

		if ( !colDef.isCalculated() && this.grid.options.gradeHistoryEnabled )
		{
			items.push( { key: "cmGradeHistory", onclick: this.onShowGradeHistory.bindAsEventListener( this ) } );
		}
		this.appendSeperator( items );

		items.push( { key : "cmModifyMsg", onclick : this.onModifyColumn.bindAsEventListener(this) } );


		if (!colDef.isTextSchema(colDef.sid))
		{
			items.push( { key : "cmColumnStatsMsg", onclick : this.onItemStats.bindAsEventListener(this) } );
		}
		if (!colDef.isPublic())
		{
			items.push( { key : "cmMakeExternalGradeMsg", onclick : this.onMakeExternalGrade.bindAsEventListener(this) } );
		}
		if (!colDef.isPublic())
		{
			items.push( { key : "cmStudentAvailableMsg", onclick : this.onToggleColumnStudentVisibility.bindAsEventListener(this) } );
		}

		this.appendSeperator( items );

		if (colDef.isAllowMulti())
		{
			items.push( { key : "cmClearAllAttemptsMsg", onclick : this.onShowClearAttemptsForm.bindAsEventListener(this) } );
		}

		this.appendSeperator( items );

		items.push( { key : "cmSortAscendingMsg", onclick : this.onSortAscending.bindAsEventListener(this) } );
		items.push( { key : "cmSortDescendingMsg", onclick : this.onSortDescending.bindAsEventListener(this) } );
		items.push( { key : "cmHideItemMsg", onclick : this.onHideColumn.bindAsEventListener(this) } );

		if ((colDef.isManual() || colDef.isCalculated()) && !colDef.isPublic())
		{
			items.push( { key : "cmDeleteItemMsg", onclick : this.onDeleteColumn.bindAsEventListener(this) } );
		}

		return items;
	},

	getGradeContextMenuItems : function()
	{
		var gridCell = this.getGridCell();
		if (gridCell.isExcluded() || gridCell.colDef.isCalculated())
		{
			return null;
		}

		var items = [];
		items.push( { key : "cmGrade360Msg", onclick : this.onShowGradeDetails.bindAsEventListener(this) } );

		if ( gridCell.canAddComment() )
		{
			// onAddComment will set focus so we do not want the context menu framework to do it onClick
			items.push( { key : "cmAddCommentMsg", onclick : this.onAddComment.bindAsEventListener(this), doNotSetFocusOnClick : true } );
		}

		this.appendSeperator(items);

		if ( !gridCell.isExempt() )
		{
			items.push( { key : "cmExemptGrade", onclick : this.onExemptGrade.bindAsEventListener(this) } );
		}
		else
		{
			items.push( { key : "cmClearExemption", onclick : this.onClearExemption.bindAsEventListener(this) } );
		}

		this.appendSeperator(items);

		if ( gridCell.isActivity() )
		{
			items.push( { key : "cmStudentActivityMsg", onclick : gridCell.gotoActivity.bindAsEventListener( gridCell ) } );
		}

		if ( gridCell.hasGradableAttempts() )
		{
			if ( gridCell.data.attemptsInfo )
			{
				items = items.concat( gridCell.getMenuDynItems() );
			}
			else
			{
				gridCell.loadAttemptsInfo( function(){
					this.contextMenuController.appendItems( this.getGridCell().getMenuDynItems() );
				}.bind(this));
			}
		}
		return items;

	},

	getStudentContextMenuItems : function()
	{
		var gridCell = this.getGridCell();
		var items = [];

		if ( gridCell.colDef.model.isolatedStudentId )
		{
			items.push( { key : "cmRestoreFromSingleStudentView", onclick : this.onShowAllRows.bindAsEventListener(this) } );
		}
		else
		{
			items.push( { key : "cmStudentHideOtherStudentsMsg", onclick : this.onHideOtherStudents.bindAsEventListener(this) } );
		}

		items.push( { key : "cmStudentStatsMsg", onclick : this.onStudentStats.bindAsEventListener(this) } );
		items.push( { key : "cmStudentAdapRelMsg", onclick : this.onAdaptiveReleaseUser.bindAsEventListener(this) } );

		this.appendSeperator( items );
		items.push( { key : "cmSendEmailMsg", onclick : this.onSendEmail.bindAsEventListener(this) } );
		this.appendSeperator( items );

		items.push( { key : "cmHideStudentMsg", onclick : this.onHideUser.bindAsEventListener(this) } );

		if( GradeCenter.courseHasGoals )
		{
			this.appendSeperator( items );
			items.push( { key : "cmReportMsg", onclick : this.onReport.bindAsEventListener(this) } );
		}

		return items;
	},

	appendSeperator : function( items )
	{
		if (!items || items[items.length -1].type == "seperator")
		{
			return;
		}
		items.push( { type : "seperator" } );
	},


	// ************ column management *******************************

	onHideColumn: function()
	{
		var colDef = this.getGridCell().getColumnDefinition();
		colDef.hideColumn();
	},

	onDeleteColumn : function()
	{
		if ( confirm( this.model.getMessage('confirmDeleteItemMsg') ) )
		{
			var colDef = this.getGridCell().getColumnDefinition();
			this.model.deleteColumn( colDef.id );
		}
	},

	onEditContent: function( )
	{
		window.location.href = this.model.gradebookService.editContentURL + "&itemId=" + this.getGridCell().getColumnDefinition().id;
	},

	onModifyColumn : function()
	{
		var colDef = this.getGridCell().getColumnDefinition();
		this.model.modifyColumn( colDef.id, colDef.type );
	},

	onShowGradeHistory: function()
	{
		var colDef = this.getGridCell().getColumnDefinition();
		window.location.href = "/webapps/gradebook/do/instructor/getGradeHistory?course_id=" + colDef.model.courseId + "&itemId=" + colDef.id;
	},

	onToggleColumnStudentVisibility : function()
	{
		var colDef = this.getGridCell().getColumnDefinition();
		colDef.toggleColumnStudentVisibility( colDef.id, !colDef.vis );
		this.closePopupsAndRestoreFocus();
	},

	onMakeExternalGrade : function()
	{
		var colDef = this.getGridCell().getColumnDefinition();
		this.model.gradebookService.makeExternalGrade( colDef.id );
		this.closePopupsAndRestoreFocus();
	},


	// ************ comments logic *******************************

	onAddComment: function()
	{
		this.closePopups();
		// here rather than on close to fix a UI glitch 1st time the div is shown
		theGradeCenter.instructorCommentsResize._reset();
		theGradeCenter.studentCommentsResize._reset();
		var pos = GradebookUtil._toAbsolute(this.htmlCell);
		var submitCommentsButton = $("submitCommentsButton");
		if (submitCommentsButton.onclickHandler)
		{
			Event.stopObserving(submitCommentsButton, 'click', submitCommentsButton.onclickHandler);
		}
		submitCommentsButton.onclickHandler = this.onSubmitComments.bindAsEventListener(this);
		Event.observe(submitCommentsButton,'click',submitCommentsButton.onclickHandler);

		var vtbeCommentsButton = $("vtbeCommentsButton");
		if (vtbeCommentsButton.onclickHandler){
			Event.stopObserving(vtbeCommentsButton, 'click', vtbeCommentsButton.onclickHandler);
		}
		vtbeCommentsButton.onclickHandler = this.onVtbeComments.bindAsEventListener(this);
		Event.observe(vtbeCommentsButton,'click',vtbeCommentsButton.onclickHandler);

		var readOnlyStudentComments = $("readOnlyStudentComments");
		if (readOnlyStudentComments.onclickHandler){
			Event.stopObserving(readOnlyStudentComments, 'click', readOnlyStudentComments.onclickHandler);
		}
		readOnlyStudentComments.onclickHandler = this.onVtbeComments.bindAsEventListener(this);
		Event.observe(readOnlyStudentComments,'click',readOnlyStudentComments.onclickHandler);

		var readOnlyInstructorComments = $("readOnlyInstructorComments");
		if (readOnlyInstructorComments.onclickHandler){
			Event.stopObserving(readOnlyInstructorComments, 'click', readOnlyInstructorComments.onclickHandler);
		}
		readOnlyInstructorComments.onclickHandler = this.onVtbeComments.bindAsEventListener(this);
		Event.observe(readOnlyInstructorComments,'click',readOnlyInstructorComments.onclickHandler);

		var commentsDiv = $("commentsDiv");
		page.util.exposeElementForMeasurement( commentsDiv );
		if (commentsDiv.onclickHandler)
		{
			Event.stopObserving(commentsDiv, 'click', commentsDiv.onclickHandler);
		}
		commentsDiv.onclickHandler = this.onClickCommentsDiv.bindAsEventListener(this);
		Event.observe(commentsDiv,'click',commentsDiv.onclickHandler);
		var ie = GradebookUtil.isIE();
		var rightedge = ie ? document.body.clientWidth: window.innerWidth;
		var bottomedge = ie ? document.body.clientHeight: window.innerHeight;
		var offright=false;
		var offbottom=false;
		if( pos.y+commentsDiv.offsetHeight>bottomedge )
		{
			offbottom = true;
		}
		if( pos.y-commentsDiv.offsetHeight<0 )
		{
			offbottom = false;
		}
		if( pos.x+commentsDiv.offsetWidth>rightedge-20 )
		{
			offright = true;
		}
		page.util.unExposeElementForMeasurement( commentsDiv );
		if( offbottom )
		{
			$("commentArrowUp").style.display="none";
			$("commentArrowDown").style.display="block";
			$("commentArrowDown").className="bubArrowBot";
			pos.y=pos.y-commentsDiv.offsetHeight;
		}
		else
		{
			$("commentArrowUp").style.display="block";
			$("commentArrowDown").style.display="none";
			$("commentArrowUp").className="bubArrowTop";
		}
		if ( offright )
		{
			$("commentArrowDown").className="bubArrowBot2";
			$("commentArrowUp").className="bubArrowTop2";
			pos.x=pos.x-200;
		}
		commentsDiv.style.top = ( pos.y - this.htmlCell.offsetHeight )+"px";
		commentsDiv.style.left = pos.x+"px";
		commentsDiv.style.display="block";
		if ( GradebookUtil.isFFonMac() )
		{
			GradebookGridUtil.shimDiv( commentsDiv );
		}
		this.model.onAddComment(this.getUserId(), this.getColDefId());
		Gradebook.CellController.commentCell = this.htmlCell;
		// delay focusing on comments text area so it has time to render
		// The commentsDiv contains two Form.Element.Resize controllers for the comments/feedback text areas. (see resize.js) 
		// These controllers need a little time to reset when the div is made visible.
		(function() { $( 'studentComments' ).focus();  }.delay( 0.5 ) );
	},

	onVtbeComments: function() {
		// Open a lightbox
		var thisCell = this.getGridCell();
		var userId = thisCell.getUserId();
		var colId = thisCell.colDef.id;
		var courseId = thisCell.colDef.model.courseId;
		var lightboxParam = {
			defaultDimensions: { w:800, h:600 },
			ajax: {url: '/webapps/gradebook/do/instructor/viewQuickComments?course_id='+courseId+'&courseMembershipId=_'+ userId + '_1&outcomeDefinitionId=_' + colId + '_1',
				loadExternalScripts: true,
				asyn : false
			},
			title: GradebookUtil.getMessage('quickcommentVtbeTitle'),
			closeOnBodyClick: false,
			showCloseLink: false,
			contents: '',
			useDefaultDimensionsAsMinimumSize: true
		};
		var quickCommentsLightbox = new lightbox.Lightbox( lightboxParam );
		quickCommentsLightbox.open( );
		this.afterSavingItem();
		this.closeComments();
	},

	onSubmitComments: function()
	{
		var instructorNotes = $("instructorComments");
		var studentComments = $("studentComments");
		if ( !GradebookUtil.validateMaxLength( instructorNotes, GradebookUtil.getMessage( 'instructorNotesMsg' ), 1000 ) )
		{
			return false;
		}
		if ( !GradebookUtil.validateMaxLength( studentComments, GradebookUtil.getMessage( 'feedBackToUserMsg' ), 1000 ) )
		{
			return false;
		}
		this.model.setComments( this.getUserId(), this.getColDefId(), studentComments.value, instructorNotes.value);
		this.afterSavingItem();
		this.closeComments();
	},

	onClickCommentsDiv: function(evt)
	{
		var eventTarget = evt.target ? evt.target : evt.srcElement;
		Gradebook.CellController.prototype.lastCommentsEventTarget = eventTarget;
	},

	testCommentsOpen: function(evt)
	{
		if (!evt)
		{
			return;
		}
		var ctrl = Gradebook.CellController.prototype;
		var eventTarget = evt.target ? evt.target : evt.srcElement;
		// if editing comments prompt user to save if click outside comments div
		if ( $("commentsDiv").getStyle("display") != "none" &&
			ctrl.lastCommentsEventTarget != eventTarget)
		{
			if ( confirm( GradebookUtil.getMessage( 'uncommitedCommentChangeErrorMsg' ) ) )
			{
				$("submitCommentsButton").onclick();
			}
			else {
				ctrl.closeComments();
			}
		}
	},

	closeComments: function()
	{
		// focus the cell
		if (  Gradebook.CellController.commentCell )
		{
			var cell = $( Gradebook.CellController.commentCell.id );
			cell.addClassName( 'cellClick' );
			cell.down( 'a' ).focus();
		}
		var commentsDiv = $("commentsDiv");
		commentsDiv.style.display="none";
		var submitCommentsButton = $("submitCommentsButton");
		if (submitCommentsButton.onclickHandler)
		{
			Event.stopObserving(submitCommentsButton, 'click', submitCommentsButton.onclickHandler);
			submitCommentsButton.onclickHandler = null;
		}
		if (commentsDiv.onclickHandler)
		{
			Event.stopObserving(commentsDiv, 'click', commentsDiv.onclickHandler);
			commentsDiv.onclickHandler = null;
		}
		$("shimDiv").style.display="none";

	},

	//************ grading *******************************

	onGradeAnonymously : function()
	{
		this._gradeAttempts( true );
	},

	onGradeAttempts : function()
	{
		this._gradeAttempts( false );
	},

	_gradeAttempts : function( anonymousMode )
	{
		var colDef = this.getGridCell().getColumnDefinition();
		var userId = colDef.getFirstUserWithCurrentViewAttempt( anonymousMode );
		if (!userId)
		{
			alert( this.model.getMessage('noUsersFoundAlertMsg') );
			return;
		}
		colDef._gradeAttempts( anonymousMode );
	},

	//************ miscellaneous *******************************

	closePopups: function(evt)
	{
		$("infodiv").style.display="none";
		$("icondiv_up").style.display="none";
		$("icondiv_down").style.display="none";
		$("shadow").style.display = "none";
		if ( Gradebook.doNotCloseAttemptsForm )
		{
			Gradebook.doNotCloseAttemptsForm = false;
		}
		else
		{
			$("clearAttemptsFlyOut").style.display = "none";
		}
		Gradebook.CellController.prototype.testCommentsOpen(evt);
		$("shimDiv").style.display="none";
	},

	getGradeGridCell: function()
	{
		return this.gridCell;
	},

	getHeaderGridCell: function()
	{
		return this.grid.viewPort.getHeaderGridCell(this.col);
	},

	closePopupsAndRestoreFocus: function(evt)
	{
		var ctrl = Gradebook.CellController.prototype;
		ctrl.closePopups(evt);

		var eventTarget = null;
		if ( evt )
		{
			eventTarget = evt.target ? evt.target : evt.srcElement;
		}

		if (ctrl.lastEventTarget == eventTarget)
		{
			ctrl.tableHasFocus = true;
		}
		else if (ctrl.tableHasFocus)
		{
			ctrl.unselectCurrentCell();
			ctrl.tableHasFocus = false;
		}
	},

	onShowClearAttemptsForm : function()
	{
		var colDef = this.getGridCell().getColumnDefinition();
		var formDiv = $('clearAttemptsFlyOut');
		var offset = Position.cumulativeOffset(this.htmlCell);
		if (this.grid.options.accessibleMode)
		{
			var tableContainer = $('table1_accessible_container');
			offset[0] -= tableContainer.scrollLeft;
			offset[1] -= tableContainer.scrollTop;
		}
		formDiv.setStyle(
			{
				display : "block"
			});
		var width = formDiv.getWidth();
		var bodyWidth = $(document.body).getWidth();
		if (page.util.isRTL())
		{
			offset[0] = offset[0] + Element.getWidth(this.contextMenuAnchor) - width;
			if (offset[0] < 0)
			{
				offset[0] = 0;
			}
		}
		if (offset[0] + width > bodyWidth)
		{
			offset[0] = offset[0] - width + Element.getWidth(this.contextMenuAnchor);
		}
		var ypos = offset[1] + Element.getHeight(this.contextMenuAnchor);
		formDiv.setStyle(
			{
				left : offset[0] + "px",
				top : ypos + "px"
			});

		// restoring default values
		if ( Gradebook.clearAttemptsFormDefault )
		{
			$('selectOption').value = Gradebook.clearAttemptsFormDefault.defaultSelect;
			$('dp_bbDateTimePicker_start_date').value = Gradebook.clearAttemptsFormDefault.defaultStartDate;
			$('dp_bbDateTimePicker_end_date').value = Gradebook.clearAttemptsFormDefault.defaultEndDate;
			$('bbDateTimePickerstart').value = Gradebook.clearAttemptsFormDefault.defaultStartDateHidden;
			$('bbDateTimePickerend').value = Gradebook.clearAttemptsFormDefault.defaultEndDateHidden;
		}
		$('clearAttemptsOptionSelect').checked = true;
		$('clearAttemptsFlyOutSubmit').onclick = this.onSubmitClearAttempts.bindAsEventListener( this ) ;
	},

	onSubmitClearAttempts: function( event )
	{
		if (event)
		{
			Event.stop( event );
		}
		//want to do this check before we give "Are you sure" confirmation msg
		if( !$('clearAttemptsOptionSelect').checked && !calendar.DateTimePicker.validatePickers( event ) )
		{
			return false;
		}
		if ( !confirm( GradebookUtil.getMessage( 'clearAttemptConfirmMsg' ) ) )
		{
			return false;
		}
		if ( $('clearAttemptsOptionSelect').checked )
		{
			// TODO: This is a hack to get around the date validation that is happening automatically on this form for the dates.
			// Ideally the validation in calendar-time.js would be able to be told about a radio button to check before validation too...
			// similar to the checkbox checking that already exists there.  This change feels safer though - to explicitly disable the validation
			// in this one case where I know we don't want it.
			var sdPicker = calendar.DatePicker.getStartDatePicker('bbDateTimePicker');
			var edPicker = calendar.DatePicker.getEndDatePicker('bbDateTimePicker');
			sdPicker.skipValidation = true;
			edPicker.skipValidation = true;
			this.getGridCell().clearAttempts( $('selectOption').value );
			sdPicker.skipValidation = false;
			edPicker.skipValidation = false;
		}
		else
		{
			var startDate = $('bbDateTimePickerstart').value;
			var endDate = $('bbDateTimePickerend').value;
			this.getGridCell().clearAttemptsByDate(startDate, endDate);
		}
		return false;
	},

	onViewColumnInfo: function()
	{
		var colDef = this.getGridCell().getColumnDefinition();
		this.closePopups();
		var info = colDef.getInfo();
		for ( var key in info )
		{
			if ( info.hasOwnProperty(key) )
			{
				$( key ).innerHTML = " " + info[ key ];
			}
		}
		var infoDiv = $('infodiv');
		var posX = this.htmlCell.viewportOffset( ).left;
		var offsetTop  = this.htmlCell.offsetHeight;
		var offsetLeft = 0;
		infoDiv.style.display = "block";
		var overflow = ( posX + infoDiv.offsetWidth ) - document.viewport.getWidth( ) + 20;
		if( ( overflow > 0 ) )
		{
			offsetLeft = -overflow;
		}
		$("bubbleArrowTop").className="bubArrowTop2";
		Element.clonePosition( infoDiv, this.htmlCell, { setWidth: false, setHeight: false, offsetLeft: offsetLeft, offsetTop: offsetTop } );
		if ( GradebookUtil.isFFonMac() )
		{
			GradebookGridUtil.shimDiv( infoDiv );
		}
	},

	onShowAlignments: function()
	{
		if ( window.bbalign )
		{
			var colDef = this.getGridCell().getColumnDefinition();
			window.bbalign.showLightbox( 'blackboard.platform.gradebook2.GradableItem;_'+ colDef.id + '_1', colDef.name.unescapeHTML(), window.courseID );
		}
	},

	onItemStats : function()
	{
		var colDef = this.getGridCell().getColumnDefinition();
		this.model.viewItemStats( colDef.id );
	},

	onHideUser : function()
	{
		this.getGridCell().hideUser();
	},

	onSendEmail : function()
	{
		var sendEmailFunc = this.grid.options.sendEmailFunc;
		if (!sendEmailFunc)
		{
			return;
		}
		var ids = [];
		ids[0] = this.getUserId();
		sendEmailFunc('S', ids);
	},

	onHideOtherStudents : function()
	{
		this.model.viewSingleStudentGrades( this.getUserId() );
	},

	onShowAllRows : function()
	{
		this.model.restoreFromSingleStudentView();
	},

	onStudentStats : function()
	{
		this.model.viewStudentStats( this.getUserId() );
	},

	onReport : function()
	{
		this.model.runReport( this.getUserId() );
	},

	onAdaptiveReleaseUser : function()
	{
		this.model.gradebookService.viewAdaptiveRelease( this.getGridCell().getInstitutionUserId() );
	},

	onShowGradeDetails : function()
	{
		this.model.showGradeDetails( this.getUserId(), this.getColDefId(), this.htmlCell.id );
	},

	onExemptGrade : function()
	{
		this.stopEdit(false, true);
		this.model.exemptGrade( this.getUserId(), this.getColDefId());
		this.closePopupsAndRestoreFocus();
	},

	onClearExemption : function()
	{
		this.model.clearExemption( this.getUserId(), this.getColDefId());
		this.closePopupsAndRestoreFocus();
	},

	onGridScroll: function()
	{
		this.closePopups();
		var done = this.unselectCurrentCell();
		return done;
	}

};
