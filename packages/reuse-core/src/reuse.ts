import * as PropTypes from 'prop-types'
import {
  Component,
  ComponentClass
} from 'react'
import {
  Listener,
  Stream
} from 'xstream'
import { Reducer } from './createStore'
import { Emitter } from './emitter'
import { ReactLifecycle } from './react-lifecycle'


export type ReuseMainFunction<P, L, S> =
  (sourceStreams: SourceStreams<P, L, S>) =>
    Sinks<P, L, S>


export interface SourceStreams<P, L, S> {
  props: Stream<P>
  state: Stream<L>
  store: Stream<S>
  lifecycle: Stream<ReactLifecycle>
}

export interface ViewSources<P, L> {
  props: P
  state: L
  emitter: typeof Emitter
}

export interface Sinks<P, L, S> {
  initialState?: L
  stateReducer?: Stream<Reducer<L>>
  storeReducer?: Stream<Reducer<S>>
  view?:
    (viewSources: ViewSources<P, L>) =>
      JSX.Element | null | false
  sideEffect?: Stream<() => void>
}


export const reuse = <P = {}, L = {}, S = {}>(mainFn: ReuseMainFunction<P, L, S>) => {
  class ReactComponent extends Component<P, L> {

    static contextTypes = {
      store: PropTypes.object,
    }

    private sources: SourceStreams<P, L, S>
    private sinks: Sinks<P, L, S>

    private stateListener: Partial<Listener<L>>
    private storeReducerListener: Partial<Listener<Reducer<S>>>
    private sideEffectListener: Partial<Listener<() => void>>

    componentWillMount() {
      const hasStore = this.context && this.context.store

      this.sources = {
        props: Stream.create(),
        state: Stream.create(),
        store: hasStore ? this.context.store.getStoreStream() : Stream.never(),
        lifecycle: Stream.create(),
      }

      this.sinks = mainFn(this.sources)
      const {
        stateReducer,
        storeReducer,
        sideEffect,
        initialState = {} as L
      } = this.sinks

      this.setState(initialState)

      if (stateReducer) {
        const state = stateReducer.fold(
          (lastState, reduce) =>
            reduce(lastState),
          initialState
        )

        this.sources.state.imitate(state.filter(v => !!v))

        this.stateListener = { next: (s: L) => this.setState(s) }
        this.sources.state.addListener(this.stateListener)
      }

      if (storeReducer && hasStore) {
        this.storeReducerListener = {
          next: (reducer: Reducer<S>) =>
            this.context.store.sendNextReducer(reducer)
        }

        storeReducer.addListener(this.storeReducerListener)
      }

      if (sideEffect) {
        this.sideEffectListener = {
          next: (effect: () => void) => effect()
        }

        sideEffect.addListener(this.sideEffectListener)
      }

      this.sources.lifecycle.shamefullySendNext(
        ReactLifecycle.componentWillMount
      )
    }

    componentWillReceiveProps() {
      this.sources.lifecycle.shamefullySendNext(
        ReactLifecycle.componentWillReceiveProps
      )
    }

    componentDidMount() {
      this.sources.lifecycle.shamefullySendNext(
        ReactLifecycle.componentDidMount
      )
    }

    componentWillUpdate() {
      this.sources.lifecycle.shamefullySendNext(
        ReactLifecycle.componentWillUpdate
      )
    }

    componentDidUpdate() {
      this.sources.props.shamefullySendNext(this.props)

      this.sources.lifecycle.shamefullySendNext(
        ReactLifecycle.componentDidUpdate
      )
    }

    componentWillUnmount() {
      this.sources.lifecycle.shamefullySendNext(
        ReactLifecycle.componentWillUnmount
      )

      if (this.stateListener) {
        this.sources.state.removeListener(this.stateListener)
      }

      if (this.storeReducerListener) {
        this.sinks.storeReducer!.removeListener(this.storeReducerListener)
      }

      if (this.sideEffectListener) {
        this.sinks.sideEffect!.removeListener(this.sideEffectListener)
      }
    }

    render() {
      return this.sinks.view
        ? this.sinks.view({
            props: this.props,
            state: this.state,
            emitter: Emitter
          })
        : null
    }
  }


  return ReactComponent as ComponentClass<P>
}