import React from "react";
import LoginForm from "../components/LoginForm";
import { useParams } from "react-router-dom";

const LoginPage = () => {
  const { refUrl } = useParams();
  return <LoginForm refUrl={refUrl} />;
};

export default LoginPage;
