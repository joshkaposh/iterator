import { Component } from 'solid-js'
import { render } from 'solid-js/web'
import { test } from './iter/test'

const App: Component = (props) => {
    test();
    return <div>
        <h1>Hello World!</h1>
    </div>
}

render(() => <App />, document.getElementById('root')!)