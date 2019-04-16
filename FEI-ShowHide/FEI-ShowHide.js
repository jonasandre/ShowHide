define([
    'qlik',
    'translator',
    './properties',
    'text!./templates/popover-template.html',
    'text!./templates/dialog-template.html'
], function (qlik, translator, properties, popoverTemplate, dialogTemplate) {
    
    const CONTEXT_MENU_ITEMS = [
        {
            icon: 'lui-icon--export',
            text: translator.get('contextMenu.exportGroup'),
            subItems: [
                {
                    id: 'back',
                    icon: 'back-icon lui-icon--triangle-left',
                    text: translator.get('Common.Back')
                },
                {
                    id: 'export-data',
                    text: translator.get('contextMenu.export')
                }
            ]
        }
    ];

    return {
        initialProperties: {conditionalVis: [], defaultMasterObject: ''},
        support: {
            snapshot: false,
            export: false,
            exportData: false
        },
        definition: properties,
        template: '<div style="display:block; width:100%; height:100%; overflow:visible;" qva-context-menu="contextMenuFn( $event )"></div>',
        controller: function ($scope, $element, luiPopover, luiDialog) {
            // Make sure the selections bar can overlay the extension's boundaries
            $(".qv-object .qv-inner-object").css('overflow','visible');

            // On initial load, get the active visualization ID we should display and initialize the current chart object
            $scope.app = qlik.currApp();
            $scope.currentChart = getActiveVisID($scope.component.model.layout.conditionalVis);
            $scope.currentChartModel = null;

            // If we do have a chart ID, render the object.
            if($scope.currentChart) {
                renderChart();
            };

            // When data has been updated on the server
            $scope.component.model.Validated.bind(function() {
                // Make sure the selections bar can overlay the extension's boundaries
                $(".qv-object .qv-inner-object").css('overflow','visible');

                // Get the active visualization ID after the data is updated
                var chart = getActiveVisID($scope.component.model.layout.conditionalVis);

                // If we do have a chart ID and it's a different one than the currentChart, update the currentChart and then render the new object
                if(chart && chart !== $scope.currentChart) {
                    $scope.currentChart = chart;
                    renderChart();
                }
                /* Else if we do not have a chart ID, check if this is the first time we don't have a chart ID. If it is, destroy the current chart object first. If it's not the first time, we can safely assume there aren't any leftover unused objects.*/
                else if(!chart && chart !== $scope.currentChart){
                    if ($scope.currentChartModel){
                        $scope.currentChart = null;
                        destroyObject();
                    }
                }
                else if(!chart && chart === $scope.currentChart){
                    $scope.currentChartModel = null;
                }
            });

            //Contextmenu to export data
            $scope.contextMenuFn = function($event) {
                luiPopover.showToPosition({
                    template: popoverTemplate,
                    closeOnEscape: true,
                    dock: 'right',
                    x: $event.pageX,
                    y: $event.pageY,
                    controller: function($scope) {
                        $scope.items = CONTEXT_MENU_ITEMS;
                        $scope.selectItem = function(item) {
                            if (item.id == 'back') {
                                $scope.items = CONTEXT_MENU_ITEMS;
                            } else if(item.id == 'export-data') {
                                this.close();
                                exportData();
                            } else {
                                $scope.items = item.subItems;
                            }
                        }
                    }
                });                
            };

            /* If only one condition results in 1, return its visualization ID. Else if default exists, return the default 
            visualization ID, otherwise return null*/
            function getActiveVisID(conditionalVisList) {
                var conditionResults = conditionalVisList.map(function(visObject) {
                    return +visObject.condition
                });

                var sumOfResults = conditionResults.reduce(function(a, b) {return a + b;}, 0);
                var activeChart = null;
                if(sumOfResults==1){
                    if(conditionalVisList[conditionResults.indexOf(1)].conditionalMasterObject){
                        activeChart = conditionalVisList[conditionResults.indexOf(1)].conditionalMasterObject.split('|')[1]
                    }
                    else{activeChart = null}
                }
                else if($scope.component.model.layout.defaultMasterObject){activeChart = $scope.component.model.layout.defaultMasterObject.split('|')[1]}
                else{activeChart = null}

                //console.log('Condition Results:',conditionResults);
                //console.log('Active Chart is: ', activeChart);

                return activeChart;
            };

            /* If there is no current chart object (on initialization or a null chart ID), do the getObject and assign it to our template div.
               Else if there is a current chart object, destroy it first, then do the getObject and assign it to our template div. */
            function renderChart() {
                if($scope.currentChartModel==null) {
                    $scope.app.getObject($element.find('div'), $scope.currentChart).then(function(model) {
                        $scope.currentChartModel = model;
                    });
                }
                else {
                    $scope.currentChartModel.enigmaModel.endSelections(true)
                        .then(destroyObject)
                        .then(
                        function() {
                            $scope.app.getObject($element.find('div'), $scope.currentChart)
                                .then(function(model) {
                                $scope.currentChartModel = model;
                            });
                        });
                }
            };

            //Destroy any leftover models to avoid memory leaks of unused objects
            function destroyObject() {
                return $scope.app.destroySessionObject($scope.currentChartModel.layout.qInfo.qId)
                    .then(function() {$scope.currentChartModel = null;});
            };

            //Function to export data of the current chart
            function exportData() {
                var qTable = qlik.table($scope.currentChartModel);
                luiDialog.show({
                    template: dialogTemplate,
                    controller: function($scope) {
                        $scope.title = translator.get('Export.Exporting');
                        $scope.completed = false;
                        qTable.exportData({}, function(filepath) {
                            $scope.completed = true;
                            $scope.title = translator.get('Export.Completed');
                            $scope.filepath = filepath;                            
                        })
                    }
                })
            }            
        },
        paint: function ($element, $layout) {},
        resize: function () {
            return false; // We do not need to handle resizes in this extension as the charts will resize themselves.
        }
    }
});