import * as React from 'react';
interface MyComponentProps {
    baz: string;
}
interface MyComponentStates {
    dynamicState?: number;
}
export default class MyComponent extends React.Component<MyComponentProps, MyComponentStates> {
    state = { foo: 1, bar: 'str' };
    render() {
        return <div />;
    }
    otherFn() {
        this.setState({ dynamicState: 42 });
    }
}
