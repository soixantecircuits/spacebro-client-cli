import test from 'ava'
import sleep from 'sleep-promise'

import { subscribe, unsubscribe, emit, resetAll } from '../src/commands'
import spacebro from '../src/initSpacebro'

const consoleSansLog = {
  log: () => {},
  warn: console.warn,
  error: console.error
}

test.before(async t => {
  const config = {
    address: 'spacebro.space',
    port: 3333,
    channel: 'clibro-tests-commands',
    client: 'clibro'
  }
  await spacebro.init(config, consoleSansLog)
})

test.beforeEach(t => {
  t.context.logger = {
    logs: [],
    log (...args) {
      this.logs.push(args)
    },
    errors: [],
    error (...args) {
      this.errors.push(args)
    },
    warnings: [],
    warn (...args) {
      this.warnings.push(args)
    }
  }
  t.context.test_subscribe = subscribe.bind(t.context.logger)
  t.context.test_unsubscribe = unsubscribe.bind(t.context.logger)
  t.context.test_emit = emit.bind(t.context.logger)

  resetAll()
})

test('Has commands', t => {
  t.is(typeof subscribe, 'function')
  t.is(typeof unsubscribe, 'function')
  t.is(typeof emit, 'function')
})

test.serial('subscribe - Simple use', async t => {
  const { logger, test_subscribe } = t.context
  t.plan(4)

  test_subscribe({ event: 'foobar' }, () => { t.pass() })
  t.deepEqual(logger.logs, [['Subscribed to event "foobar"']])

  t.deepEqual(logger.warnings, [], 'No warnings logged')
  t.deepEqual(logger.errors, [], 'No errors logged')
})

test.failing.serial('subscribe - Data sent', async t => {
  const { logger, test_subscribe } = t.context
  t.plan(7)

  test_subscribe({ event: 'foobar' }, () => { t.pass() })
  logger.logs = []

  spacebro.client.emit('foobar')
  await sleep(200) // 200 ms
  t.deepEqual(
    logger.logs[0], ['Received event "foobar" from clibro with no data']
  )

  spacebro.client.emit('foobar', 10)
  await sleep(200) // 200 ms
  t.deepEqual(
    logger.logs[1], ['Received event "foobar" from clibro with data 10']
  )

  spacebro.client.emit('foobar', { abc: 'def' })
  await sleep(200) // 200 ms
  t.deepEqual(logger.logs[2], [
    'Received event "foobar" from clibro with data {"abc":"def"}'
  ])

  t.is(logger.logs.length, 3)
  t.deepEqual(logger.warnings, [], 'No warnings logged')
  t.deepEqual(logger.errors, [], 'No errors logged')
})

test.serial('subscribe - Twice', async t => {
  const { logger, test_subscribe } = t.context
  t.plan(5)

  test_subscribe({ event: 'foobar' }, () => { t.pass() })
  logger.logs = []
  test_subscribe({ event: 'foobar' }, () => { t.pass() })

  t.deepEqual(logger.warnings, [['"foobar" already subscribed']])
  t.deepEqual(logger.logs, [], 'No new messages logged')
  t.deepEqual(logger.errors, [], 'No errors logged')
})

test('subscribe - Reserved event', async t => {
  const { logger, test_subscribe } = t.context
  t.plan(4)

  test_subscribe({ event: 'new-member' }, () => { t.pass() })
  t.deepEqual(
    logger.errors, [['Cannot subscribe to reserved event "new-member"']]
  )
  t.deepEqual(logger.logs, [], 'No messages logged')
  t.deepEqual(logger.warnings, [], 'No warnings logged')
})

test.serial('unsubscribe - Once', async t => {
  const { logger, test_subscribe, test_unsubscribe } = t.context
  t.plan(6)

  test_subscribe({ event: 'foobar' }, () => { t.pass() })
  test_unsubscribe({ event: 'foobar' }, () => { t.pass() })
  t.deepEqual(
    logger.logs,
    [['Subscribed to event "foobar"'], ['Unsubscribed from event "foobar"']]
  )
  t.deepEqual(logger.warnings, [], 'No warnings logged')
  t.deepEqual(logger.errors, [], 'No errors logged')

  logger.logs = []
  spacebro.client.emit('foobar', { abc: 'def' })
  await sleep(200) // 200 ms
  t.deepEqual(logger.logs, [], 'Event no longer intercepted')
})

test.serial('unsubscribe - Twice', async t => {
  const { logger, test_subscribe, test_unsubscribe } = t.context
  t.plan(7)

  test_subscribe({ event: 'foobar' }, () => { t.pass() })
  test_unsubscribe({ event: 'foobar' }, () => { t.pass() })
  logger.logs = []

  test_unsubscribe({ event: 'foobar' }, () => { t.pass() })
  test_unsubscribe({ event: 'abcde' }, () => { t.pass() })
  t.deepEqual(
    logger.errors,
    [['Event "foobar" does not exist'], ['Event "abcde" does not exist']]
  )
  t.deepEqual(logger.logs, [], 'No messages logged')
  t.deepEqual(logger.warnings, [], 'No warnings logged')
})

test.serial('unsubscribe - Subscribe again', async t => {
  const { logger, test_subscribe, test_unsubscribe } = t.context
  t.plan(6)

  test_subscribe({ event: 'foobar' }, () => { t.pass() })
  test_unsubscribe({ event: 'foobar' }, () => { t.pass() })
  logger.logs = []

  test_subscribe({ event: 'foobar' }, () => { t.pass() })
  t.deepEqual(logger.logs, [['Subscribed to event "foobar"']])
  t.deepEqual(logger.warnings, [], 'No warnings logged')
  t.deepEqual(logger.errors, [], 'No errors logged')
})

test.todo('subscribe - *')
test.todo('unsubscribe - *')

test('unsubscribe - Reserved event', async t => {
  const { logger, test_unsubscribe } = t.context
  t.plan(4)

  test_unsubscribe({ event: 'new-member' }, () => { t.pass() })
  t.deepEqual(
    logger.errors, [['Cannot unsubscribe from reserved event "new-member"']]
  )
  t.deepEqual(logger.logs, [], 'No messages logged')
  t.deepEqual(logger.warnings, [], 'No warnings logged')
})

test.serial.cb('emit - No data', t => {
  const { logger, test_emit } = t.context
  t.plan(5)

  function cb (data) {
    t.deepEqual(data, {_to: null, _from: 'clibro'})
    spacebro.client.off('emitEvent', cb)
    t.end()
  }
  spacebro.client.on('emitEvent', cb)
  test_emit({ event: 'emitEvent', options: {} }, () => { t.pass() })

  t.deepEqual(logger.logs, [['Emitted event "emitEvent" with no data']])
  t.deepEqual(logger.warnings, [], 'No warnings logged')
  t.deepEqual(logger.errors, [], 'No errors logged')
})

test.serial.cb('emit - Valid data', t => {
  const { logger, test_emit } = t.context
  t.plan(5)

  function cb (data) {
    t.deepEqual(data, {_to: null, _from: 'clibro', str: 'abcd'})
    spacebro.client.off('emitEvent', cb)
    t.end()
  }
  spacebro.client.on('emitEvent', cb)
  test_emit(
    { event: 'emitEvent', data: '{"str": "abcd"}', options: {} },
    () => { t.pass() }
  )

  t.deepEqual(
    logger.logs, [['Emitted event "emitEvent" with data {"str": "abcd"}']]
  )
  t.deepEqual(logger.warnings, [], 'No warnings logged')
  t.deepEqual(logger.errors, [], 'No errors logged')
})

test.serial('emit - Invalid data', async t => {
  const { logger, test_emit } = t.context
  t.plan(4)

  function cb (data) {
    t.fail('No callback should be called')
    spacebro.client.off('emitEvent', cb)
  }
  spacebro.client.on('emitEvent', cb)
  test_emit(
    { event: 'emitEvent', data: 'parse}THIS', options: {} },
    () => { t.pass() }
  )

  t.deepEqual(
    logger.errors,
    [['Parsing Error: data is not valid json']]
  )
  t.deepEqual(logger.logs, [], 'No messages logged')
  t.deepEqual(logger.warnings, [], 'No warnings logged')
})

test.failing.serial('emit - With --interval', async t => {
  const { logger, test_emit } = t.context
  const intervalCount = 3
  t.plan(intervalCount + 5)

  function cb (data) {
    t.deepEqual(data, {_to: null, _from: 'clibro', str: 'abcd'})
  }
  spacebro.client.on('emitEvent', cb)

  test_emit(
    {
      event: 'emitEvent',
      data: '{"str": "abcd"}',
      options: {interval: 0.5} // 500ms
    },
    () => { t.pass() }
  )
  t.deepEqual(
    logger.logs,
    [['Emitting event "emitEvent" every 0.5s with data {"str": "abcd"}']]
  )
  await sleep(intervalCount * 500 + 400)
  logger.logs = []

  t.deepEqual(logger.logs, [], 'No messages logged')
  t.deepEqual(logger.warnings, [], 'No warnings logged')
  t.deepEqual(logger.errors, [], 'No errors logged')

  spacebro.client.off('emitEvent', cb)
  test_emit({ event: 'emitEvent', options: {stop: true} }, () => { t.pass() })
})

test.serial('emit - With --interval, wrong parameter', t => {
  const { logger, test_emit } = t.context
  t.plan(6)

  test_emit(
    { event: 'emitEvent', options: {interval: 'abcd'} },
    () => { t.pass() }
  )
  t.deepEqual(
    logger.errors, [['Error: the interval must be a positive integer']]
  )
  logger.errors = []

  test_emit(
    { event: 'emitEvent', options: {interval: -10} },
    () => { t.pass() }
  )
  t.deepEqual(
    logger.errors, [['Error: the interval must be a positive integer']]
  )

  t.deepEqual(logger.logs, [], 'No messages logged')
  t.deepEqual(logger.warnings, [], 'No warnings logged')
})

test.serial('emit - With --stop', async t => {
  const { logger, test_emit } = t.context
  t.plan(5)

  function cb () {
    t.fail('No event should be sent')
  }
  spacebro.client.on('stopEvent', cb)
  test_emit(
    { event: 'stopEvent', options: {interval: 0.5} },
    () => { t.pass() }
  )
  test_emit(
    { event: 'stopEvent', options: {stop: true} },
    () => { t.pass() }
  )

  await sleep(200)

  t.deepEqual(logger.logs, [
    ['Emitting event "stopEvent" every 0.5s with no data'],
    ['Cleared interval for event "stopEvent"']
  ])
  t.deepEqual(logger.warnings, [], 'No warnings logged')
  t.deepEqual(logger.errors, [], 'No errors logged')

  spacebro.client.off('stopEvent', cb)
})

test.serial('emit - Use --interval twice', async t => {
  const { logger, test_emit } = t.context

  test_emit({event: 'emitEvent', options: {interval: 0.5}}, () => { t.pass() })
  logger.logs = []

  test_emit({event: 'emitEvent', options: {interval: 0.5}}, () => { t.pass() })

  t.deepEqual(logger.errors, [['Error: "emitEvent" is already being emitted']])
  t.deepEqual(logger.logs, [], 'No messages logged')
  t.deepEqual(logger.warnings, [], 'No warnings logged')

  test_emit({ event: 'emitEvent', options: {stop: true} }, () => { t.pass() })
})

test('emit - Use --interval and --stop at the same time', t => {
  const { logger, test_emit } = t.context

  test_emit(
    { event: 'whatever', options: {interval: 0.5, stop: true} },
    () => { t.pass() }
  )

  t.deepEqual(logger.errors, [[
    'Error: Cannot use both --interval and --stop in the same command'
  ]])
  t.deepEqual(logger.logs, [], 'No messages logged')
  t.deepEqual(logger.warnings, [], 'No warnings logged')
})

test.serial('emit - With --stop without --interval', async t => {
  const { logger, test_emit } = t.context
  t.plan(4)

  test_emit(
    { event: 'stopEvent', options: {stop: true} },
    () => { t.pass() }
  )
  t.deepEqual(
    logger.errors, [['Error: interval "stopEvent" does not exist']]
  )
  t.deepEqual(logger.logs, [], 'No messages logged')
  t.deepEqual(logger.warnings, [], 'No warnings logged')
})
