type HelloProps = {
  message?: string
};
const Hello: React.SFC<HelloProps> = ({ message }) => {
  return <div>hello {message}</div>;
};
Hello.propTypes = {
  message: React.PropTypes.string
};
