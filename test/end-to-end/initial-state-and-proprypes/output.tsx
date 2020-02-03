import * as React from 'react';
interface MyComponentProps {
    baz: string;
}
export default class MyComponent extends React.Component<MyComponentProps, {}> {
    state = { foo: 1, bar: 'str' };
    render() {
        return <div />;
    }
}
