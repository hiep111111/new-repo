import React, { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import axios from "axios";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  Container,
  FormControl,
  FormLabel,
  IconButton,
  InputGroup,
  InputRightElement,
  Heading,
  HStack,
  Input,
  ListItem,
  Stack,
  Text,
  UnorderedList,
  useDisclosure,
} from "@chakra-ui/react";
import { HiEye, HiEyeOff } from "react-icons/hi";

import { APP_NAME, API_GATEWAY_URL } from "../../../constants/config";
import { setToken, setUserId, setUserName, setFullName } from "../../../helpers/commonHelper";
import { getToken, removeToken } from "../../../helpers/commonHelper";
import i18n from "../../i18n";

const Layout = (props) => {
  const [userName, setStateUserName] = useState("");
  const [password, setStatePassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);

  const inputRef = useRef(null);
  const { isOpen, onToggle } = useDisclosure();

  const onClickReveal = () => {
    onToggle();
    if (inputRef.current) {
      inputRef.current.focus({
        preventScroll: true,
      });
    }
  };

  useEffect(() => {
    async function checkToken() {
      const token = getToken();

      if (token) {
        try {
          const data = {
            moduleCode: "home",
          };

          const result = await axios({
            method: "POST",
            data,
            url: `${API_GATEWAY_URL}/v1/users/ping`,
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          const { refUrl } = props;

          if (refUrl) {
            window.location.href = decodeURIComponent(refUrl);
          } else {
            const { moduleList, currentModuleCode } = result.data.data;

            if (currentModuleCode) {
              window.location.href = `/${currentModuleCode}/`;
              return;
            } else if (moduleList.length) {
              const firstModule = moduleList.find((m) => m.moduleOrder > 0);
              const { moduleCode } = firstModule;

              if (firstModule) {
                window.location.href = `/${moduleCode}/`;
                return;
              }
            }

            removeToken();
            window.location.href = "/";
          }
        } catch (error) {
          removeToken();
          window.location.href = "/";
        }
      }
    }

    checkToken();
  }, [props]);

  const onChange = (event) => {
    event.preventDefault();
    const name = event.target?.name;
    const value = event.target?.value;

    if (name === "userName") setStateUserName(value);
    if (name === "password") setStatePassword(value);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { refUrl } = props;
    const user = { userName, password };

    try {
      const result = await axios({
        method: "POST",
        data: { credentials: user },
        url: `${API_GATEWAY_URL}/v1/users/login`,
      });

      const { _id, token, fullName, moduleList, defaultFunctionUrl } = result.data.data;

      setToken(token);
      setUserId(_id);
      setUserName(userName);
      setFullName(fullName);

      if (refUrl) {
        window.location.href = decodeURIComponent(refUrl);
      } else {
        if (defaultFunctionUrl) {
          window.location.href = defaultFunctionUrl;
          return;
        } else if (moduleList.length) {
          const firstModule = moduleList.find((m) => m.moduleOrder > 0);
          const { moduleCode } = firstModule;

          if (firstModule) {
            window.location.href = `/${moduleCode}/`;
            return;
          }
        }

        setLoading(false);
        setError(true);
        setMessages(`${i18n.t("permissionDenied")}`);
      }
    } catch (error) {
      setLoading(false);
      setError(true);
      setMessages(`${i18n.t("errorHasOccurred")}: ${error.response.data.error.message}`);
    }
  };

  return (
    <Container maxW="lg" py={{ base: "12", md: "24" }} px={{ base: "0", sm: "8" }}>
      <Stack spacing="8">
        <Stack spacing="6">
          <Stack spacing={{ base: "2", md: "3" }} textAlign="center">
            <Heading size={{ base: "xs", md: "lg" }}>Log in to your account</Heading>
            <HStack spacing="1" justify="center">
              <Text color="muted">Don't have an account?</Text>
              <Button variant="link" colorScheme="blue">
                Sign up
              </Button>
            </HStack>
          </Stack>
        </Stack>

        <Box
          py={{ base: "0", sm: "8" }}
          px={{ base: "4", sm: "10" }}
          bg={{ base: "transparent", sm: "gray.100" }}
          boxShadow={{ base: "none", sm: "md" }}
          borderRadius={{ base: "none", sm: "xl" }}
        >
          {error && (
            <Box mb="5" color="white" bg="tomato" borderRadius="base">
              <UnorderedList mx="10" my="3">
                <ListItem>{messages}</ListItem>
              </UnorderedList>
            </Box>
          )}
          <form onSubmit={onSubmit}>
            <Stack spacing="6">
              <Stack spacing="5">
                <FormControl>
                  <FormLabel>User Name</FormLabel>
                  <Input
                    name="userName"
                    value={userName}
                    borderColor="teal"
                    color="teal"
                    placeholder="Username"
                    required
                    onChange={onChange}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Password</FormLabel>
                  <InputGroup>
                    <InputRightElement>
                      <IconButton
                        variant="link"
                        aria-label={isOpen ? "Mask password" : "Reveal password"}
                        icon={isOpen ? <HiEyeOff /> : <HiEye />}
                        onClick={onClickReveal}
                      />
                    </InputRightElement>
                    <Input
                      name="password"
                      value={password}
                      borderColor="teal"
                      color="teal"
                      type={isOpen ? "text" : "password"}
                      required
                      placeholder="Password"
                      onChange={onChange}
                    />
                  </InputGroup>
                </FormControl>
              </Stack>
              <Stack spacing="6">
                <Button isLoading={loading} type="submit" colorScheme="teal">
                  Sign in
                </Button>
              </Stack>
            </Stack>
          </form>
        </Box>
      </Stack>
    </Container>
  );
};

export default Layout;
