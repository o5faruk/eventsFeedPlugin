const { parseFromTimeZone } = require('date-fns-timezone')

/**
 * Method to add startDate field in event obj in required timestamp format
 * In case event is not a full day event, then insert field endDate
 */
module.exports = function (eventObj) {
  for (var key in eventObj) {
    if (eventObj.hasOwnProperty(key)) {
      var startDateComponents = key.split(";");
      let timeZone = null;
      if (key.includes("TZID=")) {
        timeZone = key.match(/TZID=([^ ]*)/)[1];
      } else {
        timeZone = "UTC"
      }
      if (startDateComponents.length && startDateComponents[0] == "DTSTART") {
        let timeString = eventObj[key];
        let date = parseFromTimeZone(timeString, { timeZone }).toISOString()
        if(timeZone === "UTC") date = date.slice(0, -1);
        eventObj.startDate = new Date(date);
      } else if (startDateComponents.length && startDateComponents[0] == "DTEND") {
        let timeString = eventObj[key];
        let date = parseFromTimeZone(timeString, { timeZone }).toISOString()
        if(timeZone === "UTC") date = date.slice(0, -1);
        eventObj.endDate = new Date(date);
      }
    }
  }
  if (!eventObj.endDate) {
    eventObj.endDate = eventObj.startDate;
  }
  return eventObj;
}
