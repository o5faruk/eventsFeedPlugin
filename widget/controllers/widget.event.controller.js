'use strict';

(function (angular, buildfire) {
  angular.module('eventsFeedPluginWidget')
    .controller('WidgetEventCtrl', ['$scope', '$sce', 'DataStore', 'TAG_NAMES', 'Location', '$routeParams', 'CalenderFeedApi', 'LAYOUTS', 'Buildfire', '$rootScope', 'EventCache',
      function ($scope, $sce, DataStore, TAG_NAMES, Location, $routeParams, CalenderFeedApi, LAYOUTS, Buildfire, $rootScope, EventCache) {
        var WidgetEvent = this;
        WidgetEvent.data = null;
        WidgetEvent.event = null;
        var currentListLayout = null;
        $rootScope.deviceHeight = window.innerHeight;
        $rootScope.deviceWidth = window.innerWidth || 320;
        $rootScope.backgroundImage = "";
        var getEventDetails = function (url) {
          var success = function (result) {
            console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>", result);
            $rootScope.showFeed = false;
            WidgetEvent.event = result;
            $scope.eventDescription = $sce.trustAsHtml(WidgetEvent.event.DESCRIPTION.replace(new RegExp("\\\\;", "g"), ";").replace(new RegExp("\\\\,", "g"), ",").replace(new RegExp("\\\\n", "g"), "<br/>"));
          }
            , error = function (err) {
              $rootScope.showFeed = false;
              console.error('Error In Fetching events', err);
            };

        };
        if ($routeParams.eventIndex) {
          if (EventCache.getCache()) {
            $rootScope.showFeed = false;
            WidgetEvent.event = EventCache.getCache();
            if (WidgetEvent.event.DESCRIPTION) {
              let description = WidgetEvent.event.DESCRIPTION.replace(new RegExp("\\\\;", "g"), ";").replace(new RegExp("\\\\,", "g"), ",").replace(new RegExp("\\\\n", "g"), "<br/>");
              var linkedText = Autolinker.link(description, {
                //removes target and rel attributes so that links can be clickable
                replaceFn: function (match) {
                  var tag = match.buildTag();
                  if(tag && tag.attrs){
                    delete tag.attrs.rel;
                    delete tag.attrs.target;
                  }
                  return tag;
                }
              });
              $scope.eventDescription = $sce.trustAsHtml(linkedText);
            }
          }
          else {
            CalenderFeedApi.getSingleEventDetails(url, $routeParams.eventIndex, $rootScope.selectedDate).then(success, error);
          }
        }
        /*declare  the device width heights*/
        WidgetEvent.deviceHeight = window.innerHeight;
        WidgetEvent.deviceWidth = window.innerWidth;

        /*crop image on the basis of width heights*/
        WidgetEvent.cropImage = function (url, settings) {
          if (!url) {
            return "";
          }
          else {
            //return Buildfire.imageLib.cropImage(url, options);
            Buildfire.imageLib.local.cropImage(url, {
              width: settings.width,
              height: settings.height
            }, function (err, imgUrl) {
              return imgUrl;
            });
          }
        };

        WidgetEvent.setAddedEventToLocalStorage = function (event) {
          var addedEvents = JSON.parse(localStorage.getItem('localAddedEventsFeed'));
          if (!addedEvents) {
            addedEvents = [];
          }
          addedEvents.push(event);
          localStorage.setItem('localAddedEventsFeed', JSON.stringify(addedEvents));
        };

        WidgetEvent.getAddedEventToLocalStorage = function (event) {
          var localStorageSavedEvents = JSON.parse(localStorage.getItem('localAddedEventsFeed'));
          if (!localStorageSavedEvents) {
            return -1;
          }
          return localStorageSavedEvents.findIndex(lsevent => {
              return  typeof lsevent === 'object' && 
                      lsevent.startDate === event.startDate && 
                      lsevent.endDate === event.endDate && lsevent.UID === event.UID
          });
        };

        WidgetEvent.addEventsToCalendar = function (event) {
          /*Add to calendar event will add here*/
          WidgetEvent.Keys = Object.keys(event);
          WidgetEvent.startTimeZone = WidgetEvent.Keys[0].split('=');
          WidgetEvent.endTimeZone = WidgetEvent.Keys[1].split('=');

          var eventStartDate = new Date(event.startDate);
          var eventEndDate;
          if (!event.endDate) {
            eventEndDate = new Date(event.startDate)
          }
          else {
            eventEndDate = new Date(event.endDate);
            if(eventEndDate < eventStartDate) {
              eventEndDate.setFullYear(new Date(eventStartDate).getFullYear())
              eventEndDate.setMonth(new Date(eventStartDate).getMonth())
              eventEndDate.setDate(new Date(eventStartDate).getDate())
            }
          }
          /*Add to calendar event will add here*/

          if (WidgetEvent.getAddedEventToLocalStorage(event) != -1) {
            alert("Event already added in calendar");
          } else {
            WidgetEvent.setAddedEventToLocalStorage(event);
          }
          if (buildfire.device && buildfire.device.calendar && WidgetEvent.getAddedEventToLocalStorage(event) == -1) {
            buildfire.device.calendar.addEvent(
              {
                title: event.SUMMARY
                ,
                location: event.LOCATION
                ,
                notes: event.DESCRIPTION
                ,
                startDate: new Date(eventStartDate.getFullYear(), eventStartDate.getMonth(), eventStartDate.getDate(), eventStartDate.getHours(), eventStartDate.getMinutes(), eventStartDate.getSeconds())
                ,
                endDate: new Date(eventEndDate.getFullYear(), eventEndDate.getMonth(), eventEndDate.getDate(), eventEndDate.getHours(), eventEndDate.getMinutes(), eventEndDate.getSeconds())
                ,
                options: {
                  firstReminderMinutes: 120
                  , secondReminderMinutes: 5
                  , recurrence: event.repeatType
                  , recurrenceEndDate: new Date(2025, 6, 1, 0, 0, 0, 0, 0)
                }
              }
              ,
              function (err, result) {
                if (err)
                  console.log("******************" + err);
                else {
                  alert("Event added to calendar");
                  WidgetEvent.setAddedEventToLocalStorage(event);
                  console.log('worked ' + JSON.stringify(result));
                  $scope.$digest();
                }
              }
            );
          }
          console.log(">>>>>>>>", event);
        };

        /*initialize the device width heights*/
        var initDeviceSize = function (callback) {
          WidgetEvent.deviceHeight = window.innerHeight;
          WidgetEvent.deviceWidth = window.innerWidth;
          if (callback) {
            if (WidgetEvent.deviceWidth == 0 || WidgetEvent.deviceHeight == 0) {
              setTimeout(function () {
                initDeviceSize(callback);
              }, 500);
            } else {
              callback();
              if (!$scope.$$phase && !$scope.$root.$$phase) {
                $scope.$apply();
              }
            }
          }
        };

        /*update data on change event*/
        var onUpdateCallback = function (event) {
          setTimeout(function () {
            $scope.imagesUpdated = false;
            $scope.$digest();
            if (event && event.tag === TAG_NAMES.EVENTS_FEED_INFO) {
              WidgetEvent.data = event.data;
              if (!WidgetEvent.data.design)
                WidgetEvent.data.design = {};
              if (!WidgetEvent.data.content)
                WidgetEvent.data.content = {};
            }
            if (!WidgetEvent.data.design.itemDetailsLayout) {
              WidgetEvent.data.design.itemDetailsLayout = LAYOUTS.itemDetailsLayout[0].name;
            }

            currentListLayout = WidgetEvent.data.design.itemDetailsLayout;
            if (WidgetEvent.data.design.itemDetailsBgImage) {
              $rootScope.backgroundImage = WidgetEvent.data.design.itemDetailsBgImage;
            } else {
              $rootScope.backgroundImage = "";
            }
            $scope.imagesUpdated = !!event.data.content;
            $scope.$digest();
            $rootScope.$digest();
          }, 0);
        };

        /*
         * Fetch user's data from datastore
         */
        var init = function () {
          var success = function (result) {
            if (result.data && result.id) {
              WidgetEvent.data = result.data;
              if (!WidgetEvent.data.design)
                WidgetEvent.data.design = {};
              if (!WidgetEvent.data.content)
                WidgetEvent.data.content = {};
              if (!WidgetEvent.data.design.itemDetailsLayout) {
                WidgetEvent.data.design.itemDetailsLayout = LAYOUTS.itemDetailsLayout[0].name;
              }
              if (WidgetEvent.data.design.itemDetailsBgImage) {
                $rootScope.backgroundImage = WidgetEvent.data.design.itemDetailsBgImage;
              }
              else {
                $rootScope.backgroundImage = "";
              }
              getEventDetails(WidgetEvent.data.content.feedUrl);
            } else {
              WidgetEvent.data = {
                content: {},
                design: {}
              };
              var dummyData = { url: "http://ical.mac.com/ical/US32Holidays.ics" };
              WidgetEvent.data.content.feedUrl = dummyData.url;
              WidgetEvent.data.design.itemDetailsLayout = LAYOUTS.itemDetailsLayout[0].name;
              getEventDetails(WidgetEvent.data.content.feedUrl);
            }
          }
            , error = function (err) {
              console.error('Error while getting data', err);
            };
          DataStore.get(TAG_NAMES.EVENTS_FEED_INFO).then(success, error);
        };

        init();

        DataStore.onUpdate().then(null, null, onUpdateCallback);

        buildfire.datastore.onRefresh(function () {
          init();
          $scope.$digest();
        });

        $scope.$on("$destroy", function () {
          DataStore.clearListener();
          $rootScope.$broadcast('ROUTE_CHANGED');
        });

      }])
})(window.angular, window.buildfire);
