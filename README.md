# React JavaScript to TypeScript Transform

Converts React code written in JavaScript to TypeScript. Developed based on popular library react-javascript-to-typescript-transform with a few feature customized.

基于 react-javascript-to-typescript-transform 开发，
优先考虑转换后代码的兼容性，减少手动修正的代码量，以实现快速迁移。
详见示例

## Features:

-   Proxies `PropTypes` to `React.Component` generic type and removes PropTypes
-   Provides state typing for `React.Component` based on initial state， `setState()` calls and `this.state` in the component
-   Hoist large interfaces for props and state out of `React.Component<P, S>` into declared types
-   Convert functional components with `PropTypes` property to TypeScript and uses propTypes to generate function type declaration

## Example

**input**

```jsx
class MyComponent extends React.Component {
    static propTypes = {
        alice: PropTypes.string.isRequired,
        ate: PropTypes.number,
    };
    constructor(props) {
        super(props);
        this.ref = React.createRef();
        this.state = { allen: '' };
    }

    onClick() {
        this.setState({ drink: 3 });
    }

    render() {
        const { cake } = this.props;
        const { milk } = this.state;
        return <div ref={this.ref}>HOME</div>;
    }
}
```

**output**

```tsx
interface IMyComponentProps extends React.HTMLAttributes<Element> {
    alice: string;
    ate?: number;
    cake?: any;
}
type MyComponentState = {
    allen?: string;
    drink?: number;
    milk?: any;
};
class MyComponent extends React.Component<IMyComponentProps, MyComponentState> {
    ref: any;
    constructor(props) {
        super(props);
        this.ref = React.createRef();
        this.state = { allen: '' };
    }
    onClick() {
        this.setState({ drink: 3 });
    }
    render() {
        const { cake } = this.props;
        const { milk } = this.state;
        return <div ref={this.ref}>HOME</div>;
    }
}
```

## Usage

### Install

```
npm install -g react-proptypes-to-typescript
```

### CLI
```
react-proptypes-to-typescript "./src/**/*.js"
```

or

```
react-proptypes-to-typescript "./src/**/*.js" --remove-original-files
```

## Development

### Tests

Tests are organized in `test` folder. For each transform there is a folder that contains folders for each test case. Each test case has `input.tsx` and `output.tsx`.

```
npm test
```

#### 使用方法

1. 安装转换脚本
git clone https://github.com/laotian/react-proptypes-to-typescript.git && cd react-proptypes-to-typescript && npm install && npm run build

2. 转换
假如要批量更改 目标文件夹  /TARGET_JS_DIR/ 下所有的JS文件
首先执行:
node dist/cli.js --rename  /TARGET_JS_DIR/**
把ts自动改名为.tsx(.ts)，然后手动git提交目录文件夹下的文件，
再次执行:
node dist/cli.js  /TARGET_JS_DIR/**
完成转换

最后跟的是要转换的组件位置，支持glob区配，如**和*

3.修复
在WebStorm上，Project视图中右键点击选中目录文件夹，单点“Fix ESLINT Problems”
检查并修复常见问题：
类型限定错误：改为any, 如 const c:any = {};
TS编译有误并不容易修复，可在目标行上添加注释，忽略TS错误 // @ts-ignore
类型需要强制,可使用关键字as， 如 (componet as View).xxxx
TS 不支持以/开头的路径导入,如/js/JDBRNKit/JDBRNNativeModules, 需去掉开头的/
module.exports改为 export {}

4.验证修复
node dist/cli.js --check  /TARGET_JS_DIR/**
会检查错误的@ts-ignore/module.exports定义

