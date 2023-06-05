import { useAuth0 } from "@auth0/auth0-react";
import {
  ActionIcon,
  AppShell,
  Aside,
  Avatar,
  Box,
  Button,
  Center,
  Divider,
  Flex,
  Group,
  Image,
  Modal,
  Navbar,
  NumberInput,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Textarea,
  Title,
  Tooltip,
  createStyles,
  useMantineColorScheme,
} from "@mantine/core";
import { getHotkeyHandler, useLocalStorage } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconHistory,
  IconLock,
  IconMoonStars,
  IconSettings,
  IconSparkles,
  IconSun,
} from "@tabler/icons-react";
import { useState } from "react";
import { openai } from "./modules/openai";
import { Link } from "react-router-dom";

interface ResponseHistory {
  id: string;
  prompt: string;
  response: Array<string>;
}

interface CurrentState {
  prompt: string;
  responses: Array<string>;
}

const AIImage = () => {
  const { classes } = useStyles();
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const dark = colorScheme === "dark";
  const { user, isLoading, error, loginWithRedirect, logout } = useAuth0();

  const [config, setConfig] = useState({
    action: "generate",
    variations: 1,
  });
  const [loading, setLoading] = useState(false);

  const [currentState, setCurrentState] = useState<CurrentState>({
    prompt: "",
    responses: [],
  });
  const [responseHistory, setResponseHistory] = useLocalStorage<
    Array<ResponseHistory>
  >({
    key: "image-response-history",
    defaultValue: [],
  });

  const updateResponseHistory = (prompt: string, response: string[]) => {
    setResponseHistory((prev) => [
      ...prev,
      {
        id: String(prev.length),
        prompt: prompt,
        response: response,
      },
    ]);
  };

  const handleSubmission = async () => {
    setLoading(true);
    try {
      const response = await openai.createImage({
        prompt: currentState.prompt,
        n: config.variations,
      });

      updateResponseHistory(
        currentState.prompt,
        response.data.data.map((item: any) => item.url)
      );
      setCurrentState((prev) => ({
        ...prev,
        responses: response.data.data.map((item: any) => item.url),
      }));
    } catch (error) {
      notifications.show({
        title: "Error generating image",
        message: "Please contact the admin for resolving this issue",
        color: "red",
        autoClose: false,
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <Box className={classes.loginRoot}>
        <Modal
          opened={true}
          closeOnEscape={false}
          onClose={() => {
            // do nothing
          }}
          withCloseButton={false}
          centered
          withOverlay
          overlayProps={{ blur: 5 }}
          radius={"md"}
          style={{
            backgroundColor: dark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.5)",
          }}
          shadow="xl"
        >
          <Center>
            <Stack spacing={"xl"} align="center">
              <Stack spacing={4} align="center">
                <Title order={3}>Layers GPT</Title>
                <Text size={14} color={dark ? "violet" : "gray"}>
                  Context layers based Chat GPT
                </Text>
              </Stack>
              <Button
                onClick={() => loginWithRedirect()}
                leftIcon={<IconLock stroke={2} size={14} />}
                loading={isLoading}
              >
                {isLoading ? "Loading..." : "Login to continue"}
              </Button>
            </Stack>
          </Center>
        </Modal>
      </Box>
    );
  }

  if (error) {
    notifications.show({
      title: "Error loggin you in",
      message: "Please contact the admin for resolving this issue",
      color: "red",
      autoClose: false,
    });
  }

  const getSkeletonArray = (length: number) => {
    return Array.from({ length: length }, (_, index) => index);
  };

  return (
    <AppShell
      classNames={{ main: classes.rootContainer }}
      navbar={
        <Navbar width={{ base: 300 }} className={classes.navbar}>
          <Flex
            direction={"column"}
            h={"100%"}
            w={"100%"}
            align={"center"}
            justify={"space-between"}
          >
            <Stack w={"100%"} spacing={8} className={classes.navList}>
              <Group spacing={4} pb={8}>
                <IconHistory size={16} />
                <Title order={4}>History</Title>
              </Group>
              {responseHistory.map((history) => (
                <Tooltip
                  label={history.prompt}
                  openDelay={300}
                  position="bottom-start"
                  multiline
                >
                  <Text
                    className={classes.textLink}
                    key={history.id}
                    size={14}
                    onClick={() => {
                      console.log(history);
                      setCurrentState({
                        prompt: history.prompt,
                        responses: history.response,
                      });
                    }}
                  >
                    {history.prompt} ({history.response.length} results)
                  </Text>
                </Tooltip>
              ))}
            </Stack>
            <Stack w={"100%"}>
              <Link to="/">
                <Button variant="outline" size="xs">
                  Try Layers GPT
                </Button>
              </Link>

              <Group w={"100%"} spacing={4} align="center" position="apart">
                {user ? (
                  <Button variant="subtle" onClick={() => logout()}>
                    <Group w="100%">
                      <Avatar src={user?.picture} radius={"md"} size={"sm"} />
                      <Text>Logout</Text>
                    </Group>
                  </Button>
                ) : (
                  <Button variant="white" onClick={() => loginWithRedirect()}>
                    Login with Auth0
                  </Button>
                )}
                <ActionIcon
                  variant="subtle"
                  onClick={() => toggleColorScheme()}
                  title="Toggle color scheme"
                  color="violet"
                >
                  {dark ? (
                    <IconSun size="1.1rem" />
                  ) : (
                    <IconMoonStars size="1.1rem" />
                  )}
                </ActionIcon>
              </Group>
            </Stack>
          </Flex>
        </Navbar>
      }
      aside={
        <Aside width={{ base: 300 }} style={{ overflow: "scroll" }}>
          <Stack spacing={"xl"} align="left" p={"md"}>
            <Group spacing={4}>
              <IconSettings size={16} />
              <Title order={4}>Configurations</Title>
            </Group>
            <Select
              label="Action"
              placeholder="Select action"
              data={[{ value: "generate", label: "Generate Image" }]}
              value={config.action}
              onChange={(value) =>
                setConfig((prev) => ({ ...prev, action: String(value) }))
              }
            />
            <NumberInput
              label="Number of images to generate"
              stepHoldDelay={500}
              stepHoldInterval={100}
              min={1}
              step={1}
              max={4}
              value={Number(config.variations)}
              onChange={(value) =>
                setConfig((prev) => ({ ...prev, variations: Number(value) }))
              }
            />
            <Divider />
          </Stack>
        </Aside>
      }
    >
      <Center pb={"xl"}>
        <Stack spacing={"xl"} align="center">
          <Textarea
            w={"100%"}
            onKeyDown={getHotkeyHandler([["mod + enter", handleSubmission]])}
            classNames={{
              root: classes.textInputContainer,
              input: classes.textInput,
            }}
            autosize
            maxRows={4}
            placeholder="Describe image do you want to generate?"
            radius={"md"}
            value={currentState.prompt}
            onChange={(event) =>
              setCurrentState((prev) => ({
                ...prev,
                prompt: event.target.value,
              }))
            }
            rightSection={
              <ActionIcon variant="subtle" onClick={handleSubmission}>
                <IconSparkles stroke={2} size={16} color="violet" />
              </ActionIcon>
            }
          />
          {loading ? (
            <SimpleGrid cols={2} w={620}>
              {getSkeletonArray(config.variations).map((img) => (
                <Skeleton key={img} width={300} height={300} radius={"sm"} />
              ))}
            </SimpleGrid>
          ) : (
            <SimpleGrid cols={2} w={620}>
              {currentState.responses.map((img, index) => (
                <Image
                  key={img}
                  src={img}
                  alt={`${currentState.prompt}-${index}`}
                  width={300}
                  height={300}
                  radius={"sm"}
                />
              ))}
            </SimpleGrid>
          )}
        </Stack>
      </Center>
    </AppShell>
  );
};

export default AIImage;

const useStyles = createStyles((theme) => ({
  loginRoot: {
    background: 'url("/bg.jpg") no-repeat center center fixed',
    backgroundSize: "cover",
    height: "100vh",
    width: "100vw",
    position: "absolute",
    left: 0,
    margin: 0,
    padding: 0,
  },
  rootContainer: {
    height: "100vh",
    overflowY: "auto",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    width: "100vw",
  },
  navbar: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    padding: 16,
  },
  textInputContainer: {
    padding: 16,
  },
  textInput: {
    // soft shadow for dark and light mode
    boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.15)",
    scrollPaddingBlockEnd: 8,
  },
  chats: {
    paddingTop: 16,
    paddingBottom: 16,
    overflowY: "scroll",
    height: "90vh",
  },
  savedGroup: {
    padding: 8,
    borderRadius: 8,
  },
  textLink: {
    cursor: "pointer",
    "&:hover": {
      textDecoration: "underline",
      color: theme.colors.violet[6],
    },
    width: 275,
    textOverflow: "ellipsis",
    overflow: "hidden",
    whiteSpace: "nowrap",
  },
  navList: {
    overflowY: "scroll",
    height: "85vh",
  }
}));
