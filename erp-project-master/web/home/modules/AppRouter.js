import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./authentication/pages/LoginPage";

const AppRouter = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Navigate to="/login/" />} />
      <Route path="/login/" element={<LoginPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/login/:refUrl" element={<LoginPage />} />
      <Route path="/logout/" element={<LoginPage />} />
      <Route path="*" element={<Navigate to="/login/" />} />
    </Routes>
  </BrowserRouter>
);

export default AppRouter;
