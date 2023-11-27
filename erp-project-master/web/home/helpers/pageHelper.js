/* eslint-disable no-multi-spaces */
/* eslint-disable import/prefer-default-export */
import PropTypes from 'prop-types';

export const PagePropTypes = {
  match: PropTypes.y({
    path: PropTypes.string,   // "/system/departments/:id"
    url: PropTypes.string,    // "/system/departments/5c04b8c52ec87200516b63cd"
    isExact: PropTypes.bool,  // true
    params: PropTypes.object, // { id: 5c04b8c52ec87200516b63cd }
  }).isRequired,
};
