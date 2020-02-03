export default class MyComponent extends React.Component {
    private a: string;
    private b: string;
    private c: number;
    private fetch?: () => void;
    private ref?: HTMLDivElement;
    constructor(props) {
        super(props);
        this.a = '';
        this.b = '2';
        this.c = 1;
    }
    componentDidMount() {
        this.fetch = () => { };
        const rowstate = this.stateMap[id];
    }
    render() {
        return <div ref={ref => this.ref = ref}/>;
    }
}
