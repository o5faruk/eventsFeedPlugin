'use strict';

(function (angular, buildfire) {
  angular.module('eventsFeedPluginWidget')
    .provider('Buildfire', [function () {
      var Buildfire = this;
      Buildfire.$get = function () {
        return buildfire
      };
      return Buildfire;
    }])
    .factory("DataStore", ['Buildfire', '$q', 'STATUS_CODE', 'STATUS_MESSAGES', function (Buildfire, $q, STATUS_CODE, STATUS_MESSAGES) {
      var onUpdateListeners = [];
      return {
        get: function (_tagName) {
          var deferred = $q.defer();
          Buildfire.datastore.get(_tagName, function (err, result) {
            if (err) {
              return deferred.reject(err);
            } else if (result) {
              return deferred.resolve(result);
            }
          });
          return deferred.promise;
        },
        onUpdate: function () {
          var deferred = $q.defer();
          var onUpdateFn = Buildfire.datastore.onUpdate(function (event) {
            if (!event) {
              return deferred.notify(new Error({
                code: STATUS_CODE.UNDEFINED_EVENT,
                message: STATUS_MESSAGES.UNDEFINED_EVENT
              }), true);
            } else {
              return deferred.notify(event);
            }
          });
          onUpdateListeners.push(onUpdateFn);
          return deferred.promise;
        },
        clearListener: function () {
          onUpdateListeners.forEach(function (listner) {
            listner.clear();
          });
          onUpdateListeners = [];
        }
      }
    }])
    .factory('CalenderFeedApi', ['$q', '$http', 'STATUS_CODE', 'STATUS_MESSAGES', 'PAGINATION', 'PROXY_SERVER',
      function ($q, $http, STATUS_CODE, STATUS_MESSAGES, PAGINATION, PROXY_SERVER) {
        var getProxyServerUrl = function () {
          return PROXY_SERVER.secureServerUrl;
        };
        var getSingleEventDetails = function (url, eventIndex, date) {
          var deferred = $q.defer();
          if (!url) {
            deferred.reject(new Error('Undefined feed url'));
          }
          $http.post(getProxyServerUrl()  + '/event', {
            url: url,
            index: eventIndex,
            date: date
          })
            .success(function (response) {
              if (response.statusCode == 200)
                deferred.resolve(response.event);
              else
                deferred.resolve(null);
            })
            .error(function (error) {
              deferred.reject(error);
            });
          return deferred.promise;
        };
        var getFeedEvents = function (url, date, offset, refreshData, requestType) {
            console.log("start getFeedEvents: " + new Date());
            var deferred = $q.defer();
            if (!url) {
                deferred.reject(new Error('Undefined feed url'));
            }
            var postObj = {
                url: url,
                limit: requestType == 'SELECTED' ? PAGINATION.eventsCount : PAGINATION.eventsCountAll,
                offset: offset,
                date: date,
                refreshData: refreshData
            };
            $http.post(getProxyServerUrl() + '/events', postObj).success(function (response) {
                var finalResults = {
                    events : []
                };
                finalResults.events = finalResults.events.concat(response.events);
                if (response.statusCode == 200) {
                    var promisesList = [];
                    var promiseMinusOne = $q.when();
                    for (var i = PAGINATION.eventsCountAll; i < response.totalEvents; i += PAGINATION.eventsCountAll) {
                        //begin IIFE closuse
                        (function (i) {
                            //chain off promiseMinusOne
                            var httpPromise =
                                promiseMinusOne.catch(function (e) {
                                    return e;
                                }).then(function (r) {
                                    postObj.offset = i;
                                    return $http({
                                        method: "post",
                                        url: getProxyServerUrl() + '/events',
                                        data: postObj
                                    })
                                });
                            promisesList.push(httpPromise);
                            promiseMinusOne = httpPromise;
                        }(i));
                        console.log("pushed all requests: " + new Date());
                    };
                    var chainablePromise =
                        promiseMinusOne.catch (function (e) {
                            return (e);
                        }) .then (function (r) {
                            console.log("call all requests: " + new Date());
                            $q.all(promisesList).then(function(results) {
                                console.log("got results: " + new Date());
                                for (var i = 0; i<results.length;i++) {
                                    finalResults.events = finalResults.events.concat(results[i].data.events);
                                }
                                deferred.resolve(finalResults);
                                console.log("end getFeedEvents: " + new Date());
                            });
                        });
                }
            }).error(function (error) {
                return deferred.reject(error);
            });
            return deferred.promise;
        };
        return {
          getSingleEventDetails: getSingleEventDetails,
          getFeedEvents: getFeedEvents
        };
      }])
    .factory('Location', [function () {
      var _location = window.location;
      return {
        goTo: function (path) {
          _location.href = path;
        }
      };
    }])
    .factory('EventCache', [function () {
      var event = null;
      return {
        setCache: function (data) {
          event = data;
        },
        getCache: function () {
          return event;
        }
      };
    }])
})(window.angular, window.buildfire);