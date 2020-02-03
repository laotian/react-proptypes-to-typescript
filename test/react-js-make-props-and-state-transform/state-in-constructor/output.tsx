import * as React from 'react';
export default class MyComponent extends React.Component<MyComponentProps, MyComponentStates> {
    constructor(props, context) {
        super(props, context);
        this.state = { foo: 1 };
    }
    render() {
        return <div />;
    }
}
