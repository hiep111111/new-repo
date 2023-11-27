import mongoose from 'mongoose';

const healthcheck = (req, res) => { 
  res.status(200).json({
    status: "Hi! I'm good!",
  });
};

export default healthcheck;