require([
        "jquery",
        "underscore",
        "backbone",
        "splunkjs/mvc",
		"splunkjs/mvc/utils",
        "splunkjs/mvc/simplexml/ready!"
    ], function($, _, Backbone, mvc, utils) {
        var observConfig = {
            subtree: true,
            childList: true
        };

        var ID_COLLUMN = 'extensionIDCol';
        var CHECKED_COLLUMN = 'tkinut';
        var COMMENT_COLLUMN = 'comment';
        var filterByStatus = {
            not_seen: 'grayscale(100%) brightness(120%) contrast(120%)',
            valid: 'hue-rotate(270deg) brightness(120%) contrast(120%)',
            not_valid: 'hue-rotate(150deg) brightness(120%) contrast(120%)'
        };

        var validByStatus = {
            not_seen: null,
            valid: true,
            not_valid: false
        };

        var statusByText = {
            'תקין': 'valid',
            'לא תקין': 'not_valid'
        };
        var panels = [];
        var userName="";

        function checkIfTableExist(currPanel, callback) {
            var panel = $(currPanel);
            var collumnElements = panel.find('table thead tr th');
            var idCollumn = collumnElements.find(":contains('" + ID_COLLUMN + "')").parent();
            if (collumnElements.length) {
                this.disconnect();
                if (idCollumn.length) {
                    addExtensionHTMLToTable(panel, idCollumn, collumnElements);
                    callback();
                }
            }
        };

//handles each Panel and Sets An Observer to get Event Changes
        function handleNewPanel(element, handleNewPanelData, observFunction) {
            var panelName = $(element.parentElement.parentElement).find('.panel-head h3').text().trim();
            var panelObject = {
                element: $(element),
                panelName: panelName,
            };
            var Ans = handleNewPanelData(panelObject);
            new MutationObserver(observFunction).observe(element, observConfig);
            $(element).on('click', '.isCheckedBtn', function (evt) {
                rowChange(evt, rowDataChange, userName);
            });
            $(element).on('change', '.row_comment', function (evt) {
                rowChange(evt, rowDataChange,userName);
            });

        };
        var getPanelOfElement = function getPanelOfElement(element) {
            return panels.find(function (panel) {
                return $(panel.element).find(element).length;
            });
        };
//First Running Func to Set The Addon on the DASHBOARD
        function init(observFunction, handleNewPanelData) {
            var _arguments = arguments;
            setTimeout(function () {
                var dashboardName = $('.dashboard-header h2').text().trim();
                userName = $('[class*=truncateLabel]');
                userName = userName[1].innerText;
                var panels = $('.splunk-view.splunk-table');
                if (!dashboardName || !panels.length) {
                    init.apply(undefined, _arguments); // recall the method with same parameters
                } else {
                    panels.each(function (index, element) {
                        new MutationObserver(observFunction).observe(element, observConfig);
                        initPanel(element, observFunction, handleNewPanelData);
                    });
                }
            }, 200);
        };

//Set The Addon on Each Panel
        function initPanel(element, observFunction, handleNewPanelData) {
            var observ = new MutationObserver(function (mutations) {
                checkIfTableExist.call(this, element ,function () {
                    handleNewPanel(element, handleNewPanelData, observFunction);
                });
            });
            observ.observe(element, observConfig);
        }

//Sets all Communication to the Panel Token SetUp
        async function SendData(url, panelName, record, isValid , comment, userName, Time) {
            var tokens = mvc.Components.get("default");
            var Sub = mvc.Components.get("submitted");
            Sub.set("panelName", panelName);
            Sub.set("userName", userName);
            Sub.set("isValid", isValid);
            Sub.set("ID", record);
            Sub.set("comment", comment);
            Sub.set("timetime", Time);
        }


        var rowDataChange = function rowDataChange(target, content, isValid, comment) {
            var currPanel3 = getPanelOfElement(target);
            if (currPanel3 !== undefined){
                addOrUpdateLog(target , content, isValid, comment);
            }
        };

//Sends The Data To The Token Set
        var addOrUpdateLog = function addOrUpdateLog(panelName, record, isValid, comment, userName) {
            var Time = Date.now();
            SendData('addOrUpdateLog', panelName, record, isValid , comment, userName, Time).then((data)=> console.log(data));
        };


//gets The current Event Status and Returns the New Status
        var changeStatus = function changeStatus(target, status) {
            var statuses = Object.keys(filterByStatus);
            var nextStatusIndex = (statuses.indexOf(status) + 1) % statuses.length;
            var nextStatus = statuses[nextStatusIndex];
            target.setAttribute('status', nextStatus);
            target.style.setProperty('filter', filterByStatus[nextStatus]);
            target.style.setProperty('-webkit-filter', filterByStatus[nextStatus]);
            return nextStatus;
        };

//Acts When The Observer that was Set Triggers and Change the Values With Async Funcs
        async function rowChange(evt, callback, userName) {
            var idIndex = $(evt.delegateTarget).find("thead tr th:contains('" +ID_COLLUMN + "')").index();
            var rowElements = $(evt.target.parentElement.parentElement.children);
            var checkElement = rowElements.find('.isCheckedBtn');
            var comment = rowElements.find('.row_comment').val();
            var id = rowElements[idIndex].textContent.trim();
            var status = checkElement.attr('status');
            if (evt.target.classList.contains('isCheckedBtn')) {
                status = changeStatus(evt.target, status);
            }
            if (status === 'not_seen'){
                status = null;
            } else if (status === 'not_valid'){
                status = 0;
            }else {
                status = 1;
            }
            var panelName = await getPanelOfElement(evt.target);
            addOrUpdateLog(panelName.panelName, id, status, comment, userName);
        }

//Changes The HTML To The Addon Values
        function addExtensionHTMLToTable(panel, idCollumn, collumnElements) {
            idCollumn.hide();
            var idIndex = idCollumn.index();
            var checkIndex = collumnElements.find(":contains('" + CHECKED_COLLUMN + "')").parent().index();
            var commentIndex = collumnElements.find(":contains('" + COMMENT_COLLUMN + "')").parent().index();
            panel.find('table > tbody > tr').each(function (index, element) {
                var children = element.children;
                children[idIndex].hidden = true;
                var checkCell = children[checkIndex];
                var status = statusByText[checkCell.textContent.trim()] || 'not_seen';
                var filter = filterByStatus[status];
                var img = document.createElement('img');
				var App = utils.getCurrentApp();
                img.src = '../../static/app/' + App + '/eye.png';
                children[checkIndex].style.color = 'transparent';
                img.className = 'isCheckedBtn';
                img.style.width = '32px';
                img.style.cursor = 'pointer';
                img.style.position = 'relative';
                img.style.left = '50%';
                img.style.transform = 'translateX(-50%)';
                img.setAttribute('style','-webkit-filter:' + filter);
                img.setAttribute('status', status);
                children[checkIndex].appendChild(img);
                children[checkIndex].style.width = '32px';
                var commentCell = children[commentIndex];
                var input = document.createElement('input');
                input.className = 'row_comment';
                input.value = commentCell.textContent.trim();
                commentCell.appendChild(input);
                commentCell.style.color = 'transparent';
            });

        }


        var handleNewPanelData = function handleNewPanelData(newPanel, twhere) {
            var existPanel = panels.find(function (panel) {
                return panel.panelName === newPanel.panelName;
            });
            if (!existPanel) {
                panels.push(newPanel);
            } else {
                existPanel.element = newPanel.element;
            }
        };


        var currPanel = "";
        var observFunction = function observFunction(mutations) {
            var TempTcurrPanel = getPanelOfElement(mutations[0].target);
            if (TempTcurrPanel !== undefined || currPanel === "") {
                currPanel = getPanelOfElement(mutations[0].target);
            }
            if (currPanel !== undefined){
                var collumnElements = currPanel.element.find('table thead tr th');
                var idCollumn = collumnElements.find(":contains('" + ID_COLLUMN + "')").parent();
                if (idCollumn.css('display') !== 'none') {
                    addExtensionHTMLToTable(currPanel.element, idCollumn, collumnElements);
                }
            }
        };
		console.log("BlazieKen Addon is On");
        init(observFunction, handleNewPanelData);
    }
);
