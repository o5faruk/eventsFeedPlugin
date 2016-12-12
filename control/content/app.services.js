'use strict';

(function (angular, buildfire) {
  angular.module('eventsFeedPluginContent')
    .provider('Buildfire', [function () {
      var Buildfire = this;
      Buildfire.$get = function () {
        return buildfire
      };
      return Buildfire;
    }])
    .factory("DataStore", ['Buildfire', '$q', 'STATUS_CODE', 'STATUS_MESSAGES', function (Buildfire, $q, STATUS_CODE, STATUS_MESSAGES) {
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
        save: function (_item, _tagName) {
          var deferred = $q.defer();
          if (typeof _item == 'undefined') {
            return deferred.reject(new Error({
              code: STATUS_CODE.UNDEFINED_DATA,
              message: STATUS_MESSAGES.UNDEFINED_DATA
            }));
          }
          Buildfire.datastore.save(_item, _tagName, function (err, result) {
            if (err) {
              return deferred.reject(err);
            } else if (result) {
              return deferred.resolve(result);
            }
          });
          return deferred.promise;
        }
      }
    }])
    .factory("CalendarFeed", ['$http', '$q', 'PROXY_SERVER', function ($http, $q, PROXY_SERVER) {
      return {
        validate: function (url) {
          var deferred = $q.defer();
          if (!url) {
            deferred.reject(new Error('Undefined feed url'));
          }
          var serverUrl = this.isAndroid() ? PROXY_SERVER.serverUrl : PROXY_SERVER.secureServerUrl;
          $http.post(PROXY_SERVER.serverUrl + '/validate', {
            url: url
          })
            .success(function (response) {
              if (response.statusCode == 200)
                deferred.resolve(response);
              else
                deferred.resolve(null);
            })
            .error(function (error) {
              deferred.reject(error);
            });
          return deferred.promise;

        },
        getEvents: function (url) {

        },
        isAndroid: function () {
          var userAgent = navigator.userAgent || navigator.vendor || window.opera;
          return (/android/i.test(userAgent));
        }
      }
    }]);
})(window.angular, window.buildfire);