'use strict';

(function (angular, buildfire) {
  angular.module('eventsFeedPluginWidget').controller('WidgetFeedCtrl', ['$scope', 'DataStore', 'TAG_NAMES', 'STATUS_CODE', 'Location', 'LAYOUTS', 'CalenderFeedApi', 'PAGINATION', 'Buildfire', '$rootScope', 'EventCache',
      function ($scope, DataStore, TAG_NAMES, STATUS_CODE, Location, LAYOUTS, CalenderFeedApi, PAGINATION, Buildfire, $rootScope, EventCache) {
          /*variable declaration*/
          var WidgetFeed = this;
          var currentFeedUrl = "";
          var currentDate = new Date();
          var currentLayout="";
          var formattedDate = currentDate.getFullYear() + "-" + moment(currentDate).format("MM") + "-" + ("0" + currentDate.getDate()).slice(-2) + "T00:00:00"+ moment(new Date()).format("Z");;
          var timeStampInMiliSec = +new Date(formattedDate);
          var eventFromDate;
          $rootScope.deviceHeight = window.innerHeight;
          $rootScope.deviceWidth = window.innerWidth;
          $rootScope.showFeed = true;
          $rootScope.selectedDate = timeStampInMiliSec;
          WidgetFeed.eventClassToggle = true;
          WidgetFeed.NoDataFound = false;
          WidgetFeed.clickEvent =  false;
          WidgetFeed.calledDate = null;
          WidgetFeed.getLastDateOfMonth = function (date) {
              return moment(date).endOf('month').format('DD');
          };
          WidgetFeed.getFirstDateOfMonth = function (date) {
              return moment(date).startOf('month').format('DD');
          };
          var configureDate = new Date();
          var eventRecEndDate = configureDate.getFullYear() + "-" + moment(configureDate).format("MM") + "-" + WidgetFeed.getLastDateOfMonth(configureDate) + "T23:59:59" + moment(new Date()).format("Z");
          var eventStartDate = configureDate.getFullYear() + "-" + moment(configureDate).format("MM") + "-" + WidgetFeed.getFirstDateOfMonth(configureDate) + "T00:00:00" + moment(new Date()).format("Z");
          var eventRecEndDateCheck = null;

          configureDate = new Date();
          eventFromDate = moment(configureDate.getFullYear()-1+"-"+moment(configureDate).format("MM")+'-'+moment(configureDate).format("DD")).unix()*1000;
          ///*Variable declaration to store the base or initial data*/
          $scope.toggles = [{state: true}, {state: false}, {state: true}];
          $scope.events = [];
          WidgetFeed.googleCalEvent = {
              'summary': '',
              'location': '',
              'description': '',
              'start': {
                  'dateTime': '',
                  'timeZone': ''
              },
              'end': {
                  'dateTime': '',
                  'timeZone': ''
              },
              'recurrence': [
                  'RRULE:FREQ=DAILY;COUNT=2'
              ],
              'attendees': [
                  {'email': 'lpage@example.com'}
              ],
              'reminders': {
                   'useDefault': false,
                   'overrides': [
                        {'method': 'email', 'minutes': 24 * 60}
                   ]
              }
          };
          const getTimeFromTimeZone = (event,start) => {
            try {
                const keyWord = start ? "DTSTART;TZID":"DTEND;TZID";
                let dtTZID = null;
                Object.entries(event).forEach(([key, value]) => { if (key.indexOf(keyWord) >= 0) { dtTZID = key + ":" + value } });
                if (dtTZID) {
                    const dtStartTimeRaw = dtTZID.split(':')[1];
                    const comps = /^(\d{4})(\d{2})(\d{2})(T)(\d{2})(\d{2})(\d{2})$/.exec(dtStartTimeRaw);
                    const dtStartTimeString = comps[1] + '-' + comps[2] + '-' + comps[3] + " " + comps[5] + ':' + comps[6] + ':' + comps[7];
                    return moment.tz(dtStartTimeString, dtTZID.split('"')[1]).local().toDate();
                }
            } catch (err) {
                console.error(err)
                return null;
            }
          };
         WidgetFeed.eventsAll = null;
          WidgetFeed.totalCalEvents = null;   //this is all the calendar events from the ics
          WidgetFeed.swiped = [];
          WidgetFeed.data = null;
          WidgetFeed.events = [];
          WidgetFeed.busy = false;
          WidgetFeed.offset = 0;
          /*This object is storing the base data for iCal calendar*/
          WidgetFeed.iCalEvent = {
              VERSION: 2.0,
              PRODID: "",
              "BEGIN": "VEVENT",
              DTSTAMP: "20151012T130000Z",
              "ORGANIZER;CN=Organizer": "MAILTO:Organizer e-mail",
              STATUS: "CONFIRMED",
              UID: "ATE1443440406",
              DTSTART: "20151012T130000Z",
              DTEND: "20151012T150000Z",
              SUMMARY: "Summary of the event",
              DESCRIPTION: "Description of the event",
              "X-ALT-DESC;FMTTYPE=text/html": "Description of the event",
              LOCATION: "Location of the event",
              END: "VEVENT"
          };

          /*
          * Fetch user's data from datastore
          */
          var init = function () {
              console.log("Start Init: " + new Date());
              var success = function (result) {
                  if (result.data && result.id) {
                      WidgetFeed.data = result.data;
                      if (!WidgetFeed.data.content)
                          WidgetFeed.data.content = {};
                      if (!WidgetFeed.data.design)
                          WidgetFeed.data.design = {};
                      if (!WidgetFeed.data.design.itemDetailsLayout)
                          WidgetFeed.data.design.itemDetailsLayout = LAYOUTS.itemDetailsLayout[0].name;
                      if (WidgetFeed.data.content.feedUrl)
                          currentFeedUrl = WidgetFeed.data.content.feedUrl;
                      WidgetFeed.getAllEvents();
                      console.log("End Init: " + new Date());
                  } else {
                      WidgetFeed.data = {
                          content: {},
                          design:{}
                      };
                      var dummyData = {url: "http://ical.mac.com/ical/US32Holidays.ics"};
                      WidgetFeed.data.content.feedUrl  = dummyData.url;
                      WidgetFeed.data.design.itemDetailsLayout= LAYOUTS.itemDetailsLayout[0].name;
                      WidgetFeed.getAllEvents();
                  }
              }, error = function (err) {
                  if (err && err.code !== STATUS_CODE.NOT_FOUND) {
                      console.error('Error while getting data', err);
                  }
              };
              DataStore.get(TAG_NAMES.EVENTS_FEED_INFO).then(success, error);
          };

          WidgetFeed.toISOString = function(date) {
            return moment(date).utc().format('MMM D, YYYY');
          }

          //returns the last day of the month based on current date
          var getLastDayMonth = function () {
              var month = currentDate.getMonth();
              var year = currentDate.getFullYear();
              var last_day = new Date(year, month + 1, 0);
              last_day = last_day.toISOString();
              return last_day;
          };

          var getFormatRepeatRule = function(rule){
              var formattedRule = {}, splitRule = [], days={}, bydayArraySplit = [];
              if (rule) {
                  splitRule = rule.split(';');
                  for (var i = 0; i < splitRule.length; i++) {
                      switch (splitRule[i].split('=')[0]) {
                          case 'FREQ':
                              formattedRule.freq = splitRule[i].split('=')[1];
                              break;
                          case 'UNTIL':
                              formattedRule.until = splitRule[i].split('=')[1];
                              break;
                          case 'BYDAY':
                              formattedRule.bydayArray = splitRule[i].split('=')[1];
                              bydayArraySplit = formattedRule.bydayArray.split(',');
                              for (var j = 0; j < bydayArraySplit.length; j++) {
                                  switch (bydayArraySplit[j]) {
                                      case 'MO':
                                          days.monday = true;
                                          break;
                                      case 'TU':
                                          days.tuesday = true;
                                          break;
                                      case 'WE':
                                          days.wednesday = true;
                                          break;
                                      case 'TH':
                                          days.thursday = true;
                                          break;
                                      case 'FR':
                                          days.friday = true;
                                          break;
                                      case 'SA':
                                          days.saturday = true;
                                          break;
                                      case 'SU':
                                          days.sunday = true;
                                          break;
                                  }

                              }
                              formattedRule.byday = days;
                              break;
                          case 'COUNT':
                              formattedRule.count = splitRule[i].split('=')[1];
                              break;
                          case 'INTERVAL':
                              formattedRule.interval = splitRule[i].split('=')[1];
                              break;
                      }
                  }
                  if (formattedRule && !formattedRule.count && !formattedRule.until) {
                      formattedRule.end = 'NEVER';
                  } else if (formattedRule && formattedRule.count) {
                      formattedRule.end = 'AFTER';
                  }
              }
              return formattedRule;
          };
          //this function will add repeating events to the result array to the repeat_until date passed in
          var expandRepeatingEvents = function (result, repeat_until, AllEvent) {

              var repeat_results = [];
              var daysOfWeek = ['SU','MO','TU','WE','TH','FR','SA'];

              result.events.forEach(event => {
                event.startDate = + new Date(event.startDate);
                event.endDate = + new Date(event.endDate);
              });

              for (var i = 0; i < result.events.length; i++) {
                  result.events[i].formattedRule =  getFormatRepeatRule(result.events[i].RRULE);
                  console.log(result.events[i].SUMMARY);
                  if (result.events[i].RRULE) {
                      var rruleSuffix = '';

                      //Fix for day of week recurrence issue in rrule.js
                      try{
                          if(result.events[i].RRULE.indexOf("FREQ=WEEKLY") != -1 && result.events[i].RRULE.indexOf("BYDAY=") == -1) {
                              var startDate = new Date(result.events[i].startDate);
                              var dayOfWeek = startDate.getDay();
                              rruleSuffix = ';BYDAY=' + daysOfWeek[dayOfWeek];
                          }
                      } catch(e){
                          console.log('day of week', e.message);
                      }

                      var rruleSet = new RRuleSet();
                      var strDate="";
                      if(result.events[i].DTSTART)
                          strDate = result.events[i].DTSTART;
                      else {
                          // the start date may come in different ways , based on timezone ,ex : "DTSTART;TZID=America/Los_Angeles":"20151014T095500"
                          // so just look for a property start with 'DTSTART' , and if not exist skip this event
                          var propertyName =Object.keys(result.events[i]).filter(function(k) {
                              return k.indexOf('DTSTART') == 0;
                          });
                          if(result.events[i][propertyName])
                              strDate =result.events[i][propertyName];
                          else
                              continue;
                      }
                      var year = parseInt( strDate.substr(0,4));
                      var month =parseInt(strDate.substr(4,2)) ;
                      var day = parseInt(strDate.substr(6,2));
                      var hour=parseInt(strDate.substr(9,2));
                      var minute=parseInt(strDate.substr(11,2));
                      var second=parseInt(strDate.substr(13,2));
                      console.log(result.events[i].RRULE);
                      //make sure the start date is valid
                      var dtStart = new Date(year,month-1 ,day, hour, minute, second);
                      if ( dtStart == "Invalid Date" ) {
                          console.log("Invalid Start Date for :", result.events[i].SUMMARY)
                          continue;
                      }
                      var rrule=rrulestr("RRULE:"+result.events[i].RRULE + rruleSuffix, {dtstart:dtStart});

                      rruleSet.rrule(rrule);
                      var startDate = new Date();
                      startDate.setMonth(startDate.getMonth() - 12);
                      var endDate = new Date();
                      endDate.setMonth(endDate.getMonth() +12);
                      //exclude dates if they have them in events
                      var propertyName =Object.keys(result.events[i]).filter(function(k) {
                          return k.indexOf('EXDATE') == 0;
                      });

                      var exdates = [];

                      if(result.events[i][propertyName]) {
                          exdates = result.events[i][propertyName]
                      }
                      //if there is only one exdate, it is not an array ... great
                      if(!Array.isArray(exdates)) {
                          exdates = [exdates];
                      }
                      for (var j=0;j<exdates.length;j++) {
                          var exDateStr = exdates[j];
                          var exDate = new Date(exDateStr.substr(0,4), exDateStr.substr(4,2)-1, exDateStr.substr(6,2), exDateStr.substr(9,2), exDateStr.substr(11,2), exDateStr.substr(13,2) )
                          rruleSet.exdate(exDate);
                      }

                      var mTest = rruleSet.valueOf();
                      var dates =  rruleSet.between(startDate, endDate);
                      console.log(mTest);
                      //add repeating events to the result
                      for (var j = 0; j < dates.length; j++) {
                          var temp_result = JSON.parse(JSON.stringify(result.events[i]));
                          temp_result.tmpStartDate = temp_result.startDate;
                          temp_result.startDate = Date.parse(dates[j]);
                          if (temp_result.startDate >= +new Date(eventStartDate) && temp_result.startDate <= +new Date(eventRecEndDate))
                              if (AllEvent)
                                  repeat_results.push(temp_result);
                              else if (temp_result.startDate >= timeStampInMiliSec) {
                                  repeat_results.push(temp_result);
                              }
                      }
                  } else {
                      if(result.events[i].isAllDay && result.events[i]["DTSTART;VALUE=DATE"]) {
                        result.events[i].startDate = moment(result.events[i]["DTSTART;VALUE=DATE"], 'YYYYMMDD').toDate();
                      }
                      const startDateFromTimeZone = getTimeFromTimeZone(result.events[i],true);
                      if(startDateFromTimeZone){
                          result.events[i].startDate = startDateFromTimeZone;
                      }

                      const endDateFromTimeZone = getTimeFromTimeZone(result.events[i],false);
                      if(endDateFromTimeZone){
                          result.events[i].endDate = endDateFromTimeZone;
                      }
                    
                      if (result.events[i].startDate >= +new Date(eventStartDate) && result.events[i].startDate <= +new Date(eventRecEndDate)) {
                          result.events[i].tmpStartDate = result.events[i].startDate;
                          if (AllEvent)
                              repeat_results.push(result.events[i]);
                          else if (result.events[i].startDate >= timeStampInMiliSec) {
                              repeat_results.push(result.events[i]);
                          }
                      }

              }}
              //sort the list by start date
              repeat_results.sort(function (a, b) {
                  if (a.startDate > b.startDate) {
                      return 1;
                  }
                  if (a.startDate < b.startDate) {
                      return -1;
                  }
                  // a must be equal to b
                  return 0;
              });
              return repeat_results;
          };

          /*Get all the events for calander dates*/
          WidgetFeed.getAllEvents = function() {
              console.log("start getAllEvents: " + new Date());
              var successAll = function (resultAll) {
                  console.log("#################", resultAll);

                  resultAll.events.forEach(elem => {
                    if (elem.SUMMARY === "Spring Break") {
                      elem['DTEND;VALUE=DATE'] = "20180408";
                      console.warn(elem);
                    }
                    if (elem.LOCATION) elem.LOCATION = elem.LOCATION.replace(/\\,/g, ',');
                    if (elem.DESCRIPTION) elem.DESCRIPTION = elem.DESCRIPTION.replace(/\\,/g, ',');
                    if (elem.SUMMARY) elem.SUMMARY = elem.SUMMARY.replace(/\\,/g, ',');
                  })

                  WidgetFeed.totalCalEvents = resultAll;
                  WidgetFeed.eventsAll = [];
                  var repeat_until = getLastDayMonth();
                  resultAll = expandRepeatingEvents(resultAll, repeat_until, true);

                  WidgetFeed.eventsAll = resultAll;
                  WidgetFeed.events = resultAll;

                  $scope.$broadcast('refreshDatepickers');
                  console.log("end getAllEvents: " + new Date());
              }, errorAll = function (errAll) {
                  WidgetFeed.eventsAll = [];
                  console.error('Error In Fetching events', errAll);
              };
              console.log("##############", eventFromDate);
              CalenderFeedApi.getFeedEvents(WidgetFeed.data.content.feedUrl, eventFromDate, 0, true, 'ALL').then(successAll, errorAll);
          };

          /*This method is used to load the events from the selected month*/
          WidgetFeed.loadMore = function (refreshData) {
              Buildfire.spinner.show();
              if (WidgetFeed.busy) return;
                  WidgetFeed.busy = true;
              if (WidgetFeed.data.content.feedUrl) {
                  if (WidgetFeed.totalCalEvents) {
                      var repeat_until = getLastDayMonth();
                      var resultAll = expandRepeatingEvents(WidgetFeed.totalCalEvents, repeat_until, true);
                      WidgetFeed.events = resultAll;
                      if(refreshData && refreshData ==true)
                          WidgetFeed.eventsAll = resultAll;
                      $scope.$broadcast('refreshDatepickers');
                      WidgetFeed.offset = WidgetFeed.offset + PAGINATION.eventsCount;
                      currentLayout = WidgetFeed.data.design.itemDetailsLayout;
                      WidgetFeed.clickEvent = false;
                      WidgetFeed.isCalled = true;
                      $(".glyphicon").css('pointer-events', 'auto');
                      Buildfire.spinner.hide();
                  }
              } else {
                  WidgetFeed.eventsAll=[];
              }
          };

          /*This method will give the current date*/
          $scope.today = function () {
              $scope.dt = new Date();
          };

          /*** DataStore.onUpdate() is bound to listen any changes in datastore* */
          var onUpdateCallback = function (event) {
              if (event && event.tag === TAG_NAMES.EVENTS_FEED_INFO) {
                  WidgetFeed.data = event.data;
                  if (!WidgetFeed.data.design)
                      WidgetFeed.data.design = {};
                  if (!WidgetFeed.data.content)
                      WidgetFeed.data.content = {};
                  if (!WidgetFeed.data.design.itemDetailsLayout) {
                      WidgetFeed.data.design.itemDetailsLayout = LAYOUTS.itemDetailsLayout[0].name;
                  }
                  if (!WidgetFeed.data.content.feedUrl) {
                      currentFeedUrl="";
                      WidgetFeed.events = [];
                      WidgetFeed.eventsAll=null;
                      WidgetFeed.offset = 0;
                      WidgetFeed.busy = false;
                      WidgetFeed.eventClassToggle=false;
                      WidgetFeed.loadMore(false);
                  } else if (currentFeedUrl != WidgetFeed.data.content.feedUrl) {
                      formattedDate = currentDate.getFullYear() + "-" + moment(currentDate).format("MM") + "-" + ("0" + currentDate.getDate()).slice(-2) + "T00:00:00" + moment(new Date()).format("Z");
                      timeStampInMiliSec = +new Date(formattedDate);
                      currentFeedUrl = WidgetFeed.data.content.feedUrl;
                      WidgetFeed.events = [];
                      WidgetFeed.eventsAll=[];
                      WidgetFeed.offset = 0;
                      WidgetFeed.busy = false;
                      WidgetFeed.eventClassToggle = true;
                      WidgetFeed.getAllEvents();
                      WidgetFeed.loadMore(false);
                  }
                  $scope.$broadcast('refreshDatepickers');

                  console.log("WidgetFeed.events",WidgetFeed.events);
                  if (currentLayout && currentLayout != WidgetFeed.data.design.itemDetailsLayout){
                      if (WidgetFeed.events && WidgetFeed.events.length) {
                          Location.goTo("#/event/"+0);
                      }
                  }
              }
          };
          DataStore.onUpdate().then(null, null, onUpdateCallback);

          /*This method is use to swipe left and right the event*/
          WidgetFeed.addEvents = function (e, i, toggle) {
              toggle ? WidgetFeed.swiped[i] = true : WidgetFeed.swiped[i] = false;
          };

          WidgetFeed.setAddedEventToLocalStorage= function(eventId){
              var addedEvents = JSON.parse(localStorage.getItem('localAddedEventsFeed'));
              if(!addedEvents){
                  addedEvents=[];
              }
              addedEvents.push(eventId);
              localStorage.setItem('localAddedEventsFeed', JSON.stringify(addedEvents));
          };

          WidgetFeed.getAddedEventToLocalStorage = function(eventId){
              var localStorageSavedEvents = JSON.parse(localStorage.getItem('localAddedEventsFeed'));
              if(!localStorageSavedEvents){
                  localStorageSavedEvents=[];
              }
              return localStorageSavedEvents.indexOf(eventId);
          };

          /*This method is called when we click to add an event to native calendar*/
          WidgetFeed.addEventsToCalendar = function (event, i) {
              WidgetFeed.Keys = Object.keys(event);
              WidgetFeed.startTimeZone = WidgetFeed.Keys[0].split('=');
              WidgetFeed.endTimeZone = WidgetFeed.Keys[1].split('=');

              var eventStartDate = new Date(event.startDate);
              var eventEndDate;
              if(!event.endDate){
                  eventEndDate = new Date(event.startDate)
              } else {
                  eventEndDate = new Date(event.endDate);
              }
              console.log("---------------------",eventStartDate, eventEndDate, event);
              /*Add to calendar event will add here*/

              if(WidgetFeed.getAddedEventToLocalStorage(event.UID)!=-1){
                  alert("Event already added in calendar");
              }
              console.log("inCal3eventFeed:", eventEndDate, event);
              if (buildfire.device && buildfire.device.calendar && WidgetFeed.getAddedEventToLocalStorage(event.UID)==-1) {
                  WidgetFeed.setAddedEventToLocalStorage(event.UID);
                  buildfire.device.calendar.addEvent(
                      {
                          title: event.SUMMARY
                          , location: event.LOCATION
                          , notes: event.DESCRIPTION
                          , startDate: new Date(eventStartDate.getFullYear(), eventStartDate.getMonth(), eventStartDate.getDate(), eventStartDate.getHours(), eventStartDate.getMinutes(), eventStartDate.getSeconds())
                          , endDate: new Date(eventEndDate.getFullYear(), eventEndDate.getMonth(), eventEndDate.getDate(), eventEndDate.getHours(), eventEndDate.getMinutes(), eventEndDate.getSeconds())
                          , options: {
                               firstReminderMinutes: 120
                               , secondReminderMinutes: 5
                               , recurrence: event.repeatType
                               , recurrenceEndDate: new Date(2025, 6, 1, 0, 0, 0, 0, 0)
                          }
                      }, function (err, result) {
                          if (err)
                              console.log("******************" + err);
                          else {
                              WidgetFeed.swiped[i] = false;
                              console.log('worked ' + JSON.stringify(result));
                              WidgetFeed.setAddedEventToLocalStorage(event.UID);
                              alert("Event added to calendar");
                              $scope.$digest();
                          }
                      });
              }
              console.log(">>>>>>>>", event);
          };

          WidgetFeed.getUTCZone = function () {
              return moment(new Date()).format("Z")
          };

          /*This method is used to get the event from the date where we clicked on calendar*/
          WidgetFeed.getEventDate = function (date) {
              $(".text-muted").parent().addClass('disableCircle');
              WidgetFeed.flag = false;
              formattedDate = date.getFullYear() + "-" + moment(date).format("MM") + "-" + ("0" + date.getDate()).slice(-2) + "T00:00:00" + WidgetFeed.getUTCZone();
              timeStampInMiliSec = +new Date(formattedDate);
              if (!WidgetFeed.clickEvent) {
                  if ($rootScope.chnagedMonth == undefined) {
                      eventStartDate = formattedDate;
                      var tempDt = new Date(eventStartDate);
                      eventRecEndDate = new Date(tempDt.setTime( tempDt.getTime() + 1 * 86399999 ));
                      WidgetFeed.clickEvent = true;
                      WidgetFeed.events = null;
                      WidgetFeed.busy = false;
                      WidgetFeed.disabled = true;
                      $(".glyphicon").css('pointer-events', 'none');
                      WidgetFeed.loadMore(false);
                  } else {
                      configureDate = new Date($rootScope.chnagedMonth);
                      eventStartDate = configureDate.getFullYear() + "-" + moment(configureDate).format("MM") + "-" + WidgetFeed.getFirstDateOfMonth(configureDate) + "T00:00:00" + moment(new Date()).format("Z");
                      eventRecEndDate = configureDate.getFullYear() + "-" + moment(configureDate).format("MM") + "-" + WidgetFeed.getLastDateOfMonth(configureDate) + "T23:59:59" + moment(new Date()).format("Z");
                      WidgetFeed.calledDate = +new Date(configureDate.getFullYear() + "-" + moment(configureDate).format("MM") + "-01" + "T00:00:00" + moment(new Date()).format("Z"));
                      if (eventRecEndDateCheck != eventRecEndDate) {
                          formattedDate = currentDate.getFullYear() + "-" + moment(currentDate).format("MM") + "-" + ("0" + currentDate.getDate()).slice(-2) + "T00:00:00" + moment(new Date()).format("Z");
                          timeStampInMiliSec = +new Date(eventStartDate);
                          eventRecEndDateCheck = eventRecEndDate;
                      }
                      WidgetFeed.clickEvent = true;
                      WidgetFeed.events = null;
                      WidgetFeed.busy = false;
                      WidgetFeed.disabled = true;
                      WidgetFeed.calledDate = timeStampInMiliSec;
                      $(".glyphicon").css('pointer-events', 'none');
                      WidgetFeed.loadMore(true);
                  }
              }
          };

          /*This method is used to navigate to particular event details page*/
          WidgetFeed.openDetailsPage = function (event, index) {
              EventCache.setCache(event);
              Location.goTo('#/event/' + index);
          };
          /** Enable pull down to refresh and fetch fresh data*/

          Buildfire.datastore.onRefresh(function () {
              WidgetFeed.events = [];
              WidgetFeed.eventsAll=null;
              WidgetFeed.offset = 0;
              WidgetFeed.busy = false;
              formattedDate = currentDate.getFullYear() + "-" + moment(currentDate).format("MM") + "-" + ("0" + currentDate.getDate()).slice(-2) + "T00:00:00";
              timeStampInMiliSec = +new Date(formattedDate);
              WidgetFeed.getAllEvents();
              WidgetFeed.loadMore(true);
          });

          /*** init() function invocation to fetch previously saved user's data from datastore.*/
          init();

          $scope.today();

          $scope.getDayClass = function (date, mode) {
              var dayToCheck = new Date(date).setHours(0, 0, 0, 0);
              var currentDay;
              for (var i = 0; i < WidgetFeed.eventsAll.length; i++) {
                  currentDay = new Date(WidgetFeed.eventsAll[i].startDate).setHours(0, 0, 0, 0);
                  if (dayToCheck === currentDay) {
                      return 'eventDate avoid-clicks-none';
                  }
              }
          };

          $scope.$on("$destroy", function () {
              DataStore.clearListener();
          });

          $rootScope.$on("ROUTE_CHANGED", function (e) {
              Buildfire.datastore.onRefresh(function () {
                  WidgetFeed.events = null;
                  WidgetFeed.eventsAll=null;
                  WidgetFeed.offset = 0;
                  WidgetFeed.busy = false;
                  formattedDate = currentDate.getFullYear() + "-" + moment(currentDate).format("MM") + "-" + ("0" + currentDate.getDate()).slice(-2) + "T00:00:00";
                  timeStampInMiliSec = +new Date(formattedDate);
                  WidgetFeed.getAllEvents();
                  WidgetFeed.loadMore(true);
              });
              DataStore.onUpdate().then(null, null, onUpdateCallback);
          });
      }]);
})(window.angular, window.buildfire);
