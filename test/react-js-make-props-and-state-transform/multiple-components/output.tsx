import * as React from 'react';
export default class MyComponent extends React.Component<MyComponentProps, MyComponentStates> {
    render() {
        return <button onClick={this.onclick.bind(this)}/>;
    }
    onclick() {
        this.setState({ foo: 1, bar: 2 });
    }
}
export class AnotherComponent extends React.Component<AnotherComponentProps, AnotherComponentStates> {
    static propTypes = {
        foo: React.PropTypes.string.isRequired,
    };
    render() {
        return <div />;
    }
}
