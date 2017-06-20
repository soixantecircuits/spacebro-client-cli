const spacebroClient = require('./initSpacebro').client

const intervals = {}
const subscribedEvents = {}

const reservedEvents = [
  'connect',
  'new-member',
  'connect_error',
  'connect_timeout',
  'error',
  'disconnect',
  'reconnect',
  'reconnect_attempt',
  'reconnecting',
  'reconnect_error',
  'reconnect_failed'
]

function subscribe ({ event }, callback) {
  if (subscribedEvents[event]) {
    this.warn(`"${event}" already subscribed`)
    return callback()
  }
  if (reservedEvents.indexOf(event) !== -1) {
    this.error(`Cannot subscribe to reserved event "${event}"`)
    return callback()
  }
  spacebroClient.on(event, (data) => {
    const dataObj = data
    const senderName = data._from

    if (typeof dataObj === 'object') {
      delete dataObj._to
      delete dataObj._from
    }
    try {
      let dataStr

      if (typeof dataObj === 'object' && Object.keys(dataObj).length === 0) {
        dataStr = 'no data'
      } else {
        dataStr = JSON.stringify(data)
      }
      this.log(`Received event "${event}" from ${senderName} with ${dataStr}`)
    } catch (e) {
      this.warn(e)
    }
  })
  subscribedEvents[event] = true
  this.log(`Subscribed to event "${event}"`)
  return callback()
}

function unsubscribe ({ event }, callback) {
  if (reservedEvents.indexOf(event) !== -1) {
    this.error(`Cannot unsubscribe from reserved event "${event}"`)
    return callback()
  }
  if (!subscribedEvents[event]) {
    this.error(`Event "${event}" does not exist`)
    return callback()
  }
  spacebroClient.off(event)
  subscribedEvents[event] = false
  this.log(`Unsubscribed from event "${event}"`)
  return callback()
}

function emit ({ event, data, options }, callback) {
  const dataStr = (data != null) ? `data ${data}` : 'no data'
  let dataObj

  try {
    dataObj = (data != null) ? JSON.parse(data) : data
  }
  catch (e) {
    this.error('Parsing Error: data is not valid json')
    return callback()
  }
  if (options.interval && options.stop) {
    this.error('Error: Cannot use both --interval and --stop in the same command')
    return callback()
  }

  if (options.interval) {
    if (!(options.interval > 0)) {
      this.error('Error: the interval must be a positive integer')
      return callback()
    }
    if (intervals[event]) {
      this.error(`Error: "${event}" is already being emitted`)
      return callback()
    }
    intervals[event] = setInterval(
      () => { spacebroClient.emit(event, dataObj) },
      options.interval * 1000
    )
    this.log(`Emitting event "${event}" every 0.5s with ${dataStr}`)
  }

  else if (options.stop) {
    if (!intervals[event]) {
      this.error(`Error: interval "${event}" does not exist`)
      return callback()
    }
    clearInterval(intervals[event])
    delete intervals[event]
    this.log(`Cleared interval for event "${event}"`)
  }

  else {
    spacebroClient.emit(event, dataObj)
    this.log(`Emitted event "${event}" with ${dataStr}`)
  }

  return callback()
}

module.exports = {
  subscribe,
  unsubscribe,
  emit
}
