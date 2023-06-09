import { useAuth0 } from "@auth0/auth0-react";
import {
  Accordion,
  ActionIcon,
  AppShell,
  Aside,
  Avatar,
  Box,
  Button,
  Center,
  Checkbox,
  Divider,
  Flex,
  Group,
  Loader,
  Modal,
  Navbar,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
  createStyles,
  useMantineColorScheme,
} from "@mantine/core";
import { getHotkeyHandler, useHotkeys, useLocalStorage } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconArrowRight,
  IconBoxMultiple,
  IconClearAll,
  IconDeviceFloppy,
  IconFlame,
  IconFlameOff,
  IconLock,
  IconMoonStars,
  IconPackages,
  IconPlus,
  IconSend,
  IconSettings,
  IconSun,
  IconTrash,
} from "@tabler/icons-react";
import { CreateChatCompletionRequest } from "openai";
import { useEffect, useState } from "react";
import { openai } from "./modules/openai";
import { Link } from "react-router-dom";
import axios from "axios";

interface PromptLayer {
  id: string;
  name: string;
  prompt: string;
}

interface SavedGroup {
  id: string;
  name: string;
  layers: Array<PromptLayer>;
}

const getUUID = () => {
  return Math.random().toString(36).substring(2, 9);
};

function App() {
  const { classes } = useStyles();
  const [showControls, setShowControls] = useState<boolean>(false);
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const dark = colorScheme === "dark";
  const { loginWithRedirect, isLoading, logout, user, error } = useAuth0();
  const [currentMessage, setCurrentMessage] = useState<string>("");
  const [isTyping, setIsTyping] = useState<boolean>(false);

  const [exchangeRateUsdToInr, setExchangeRateUsdToInr] = useLocalStorage<{
    value: number;
    lastUpdated: number;
  }>({
    key: "exchangeRateUsdToInr",
    defaultValue: {
      value: 0,
      lastUpdated: 0,
    },
  });

  const [isIsolated, setIsIsolated] = useLocalStorage<boolean>({
    key: "isIsolated",
    defaultValue: true,
  });
  const [showCostForLastRequest, setShowCostForLastRequest] =
    useLocalStorage<boolean>({
      key: "showCostForLastRequest",
      defaultValue: false,
    });
  const [messages, setMessages] = useLocalStorage<
    CreateChatCompletionRequest["messages"]
  >({
    key: "messages",
    defaultValue: [],
  });

  const [config, setConfig] = useState<
    Omit<CreateChatCompletionRequest, "messages">
  >({
    model: "gpt-3.5-turbo",
    temperature: 0,
  });

  const [promptLayers, setPromptLayers] = useLocalStorage<Array<PromptLayer>>({
    key: "promptLayers",
    defaultValue: [],
  });

  const [savedGroups, setSavedGroups] = useLocalStorage<Array<SavedGroup>>({
    key: "savedGroups",
    defaultValue: [],
  });

  const [currentEditingGroup, setCurrentEditingGroup] =
    useState<SavedGroup | null>(null);

  useHotkeys([
    ["mod+shift+C", () => setShowControls((c) => !c)],
    ["mod+shift+L", () => setMessages([])],
  ]);

  useEffect(() => {
    const fetchExchangeRate = async () => {
      // fetch exchange rate every day using api with axios and update the local storage
      const response = await axios.get(
        "https://api.exchangerate.host/latest?base=USD&symbols=INR"
      );
      const exchangeRate = response.data.rates.INR;
      setExchangeRateUsdToInr({
        value: exchangeRate,
        lastUpdated: new Date().getTime(),
      });
    };

    const lastUpdated = exchangeRateUsdToInr?.lastUpdated;

    if (!lastUpdated) {
      console.log("Fetching exchange rate for the first time");
      fetchExchangeRate();
      return;
    }

    const now = new Date().getTime();
    const diff = now - lastUpdated;
    const diffInDays = diff / (1000 * 3600 * 24);
    if (diffInDays > 1) {
      fetchExchangeRate();
    }
  }, []);

  const addMessage = (message: string) => {
    setMessages((prev) => [...prev, { role: "user", content: message }]);
  };

  const calculateCostForTokens = (
    tokens: number,
    model: CreateChatCompletionRequest["model"]
  ) => {
    if (model === "gpt-3.5-turbo") {
      // USD to INR
      return (0.002 / 1000) * tokens * exchangeRateUsdToInr.value;
    }
    if (model === "gpt-4") {
      return (0.006 / 1000) * tokens * exchangeRateUsdToInr.value;
    }
    return 0;
  };

  const sendChat = async (
    messages: CreateChatCompletionRequest["messages"]
  ) => {
    setIsTyping(true);
    try {
      const response = await openai.createChatCompletion({
        ...config,
        messages: messages,
        user: user?.email || "",
      });

      const choices = response.data.choices;
      const text = choices[0].message?.content;

      const newMessage = {
        role: choices[0].message?.role || "user",
        content: text || "",
      };

      if (newMessage.content) {
        setMessages((prev) => [...prev, newMessage]);
      }

      if (showCostForLastRequest) {
        const totalCost = calculateCostForTokens(
          Number(response.data.usage?.total_tokens),
          config.model
        );
        notifications.show({
          title: `Cost for last request = ₹${totalCost.toFixed(4)}`,
          message: `Tokens used: ${response.data.usage?.total_tokens}`,
          color: "cyan",
          autoClose: 5000,
        });
      }
    } catch (error: any) {
      notifications.show({
        title: "An error occured while processing the message",
        message: "Please try again, it might be a temporary issue",
        color: "red",
        autoClose: 5000,
      });
      console.log(error.response.data);
    } finally {
      setIsTyping(false);
    }
  };

  const buildPrompt = (currentPrompt: string) => {
    // Combine all prompt layers to build the prompt
    // Add a new line after each prompt layer
    // Make the added prompts in numbered list
    const prompt = promptLayers.reduce((acc, layer, index) => {
      return `${acc}${index + 1}. ${layer.prompt}\n`;
    }, `${currentPrompt} \n\nPlease also follow the following instructions before giving the final answer. Give one final answer which complies with all of the above instructions: \n\n`);

    return prompt;
  };

  const handleSubmission = async () => {
    setCurrentMessage("");
    const newPrompt = buildPrompt(currentMessage);

    const newMessage = {
      role: "user" as CreateChatCompletionRequest["messages"][0]["role"],
      content: newPrompt,
    };

    addMessage(currentMessage);

    const newMessages: CreateChatCompletionRequest["messages"] = isIsolated
      ? [newMessage]
      : [...messages, newMessage];

    await sendChat(newMessages);
  };

  const handleLayerGroupSave = () => {
    const newGroup = {
      id: getUUID(),
      name: "New Group",
      layers: promptLayers,
    };

    setSavedGroups((prev) => [...prev, newGroup]);
  };

  const handleLayerGroupDelete = (id: string) => {
    setSavedGroups((prev) => prev.filter((group) => group.id !== id));
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

  return (
    <AppShell
      hidden={showControls}
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
            <Stack w={"100%"} className={classes.navList}>
              <Group spacing={4}>
                <IconPackages size={16} />
                <Title order={4}>Layer groups</Title>
              </Group>
              <Stack spacing={4}>
                {savedGroups.map((group, index) => (
                  <Box key={index} className={classes.savedGroup}>
                    <Group spacing={4} position="apart">
                      {currentEditingGroup?.id === group.id ? (
                        <TextInput
                          value={currentEditingGroup.name}
                          onChange={(e) => {
                            const newName = e.target.value;
                            setCurrentEditingGroup((prev) => {
                              if (prev) {
                                return { ...prev, name: newName };
                              }
                              return prev;
                            });
                          }}
                          onBlur={() => {
                            // Update the group name in the saved groups
                            const newSavedGroups = savedGroups.map((g) => {
                              if (g.id === group.id) {
                                return currentEditingGroup;
                              }
                              return g;
                            });
                            setSavedGroups(newSavedGroups);
                            setCurrentEditingGroup(null);
                          }}
                        />
                      ) : (
                        <Text
                          onDoubleClick={() => setCurrentEditingGroup(group)}
                        >
                          {group.name}
                        </Text>
                      )}
                      <Group spacing={0}>
                        <Button
                          className="load-group"
                          variant="subtle"
                          onClick={() => {
                            handleLayerGroupDelete(group.id);
                          }}
                        >
                          <IconTrash size={16} />
                        </Button>
                        <Button
                          className="load-group"
                          variant="subtle"
                          onClick={() => {
                            setPromptLayers(group.layers);
                          }}
                        >
                          <IconArrowRight size={16} />
                        </Button>
                      </Group>
                    </Group>
                  </Box>
                ))}
              </Stack>
            </Stack>
            <Stack w={"100%"}>
              <Link to="/image">
                <Button variant="outline" size="xs">
                  Try Image Playground
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
              label="Model"
              placeholder="Select model"
              data={[
                { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
                { value: "gpt-4", label: "GPT-4" },
              ]}
              defaultValue={config.model}
              value={config.model}
              onChange={(value) =>
                setConfig((prev) => ({ ...prev, model: String(value) }))
              }
            />
            <NumberInput
              label="Temperature"
              description="The higher the temperature, the more variation in the results."
              stepHoldDelay={500}
              stepHoldInterval={100}
              precision={1}
              min={0}
              step={0.1}
              max={2}
              value={Number(config.temperature)}
              onChange={(value) =>
                setConfig((prev) => ({ ...prev, temperature: Number(value) }))
              }
              icon={
                config.temperature === 0 ? (
                  <IconFlameOff size={16} color="gray" />
                ) : (
                  <IconFlame size={16} color="red" />
                )
              }
            />
            <Checkbox
              label="Isolated responses"
              description="If enabled, each response will be generated independent of the previous ones."
              size={"sm"}
              checked={isIsolated}
              onChange={(event) => setIsIsolated(event.currentTarget.checked)}
            />
            <Checkbox
              label="Show cost for last request"
              description="If enabled, cost for each request will be shown as a notification."
              size={"sm"}
              checked={showCostForLastRequest}
              onChange={(event) =>
                setShowCostForLastRequest(event.currentTarget.checked)
              }
            />
            <Button
              variant="outline"
              onClick={() => {
                setMessages([]);
              }}
            >
              Clear chat
            </Button>
            <Divider />
          </Stack>
          <Stack spacing={"xl"} p={"md"}>
            <Group spacing={4} position="apart">
              <Group spacing={4}>
                <IconBoxMultiple size={16} />
                <Title order={4}>Layers</Title>
              </Group>
              <Button
                size="xs"
                variant="subtle"
                leftIcon={<IconDeviceFloppy stroke={2} size={14} />}
                onClick={handleLayerGroupSave}
              >
                Save layer group
              </Button>
            </Group>
            <Group position="apart" grow>
              <Button
                size="xs"
                variant="outline"
                leftIcon={<IconPlus stroke={2} size={14} />}
                onClick={() =>
                  setPromptLayers((prev) => [
                    ...prev,
                    { id: getUUID(), name: "", prompt: "" },
                  ])
                }
              >
                Add new
              </Button>
              <Button
                size="xs"
                variant="outline"
                leftIcon={<IconClearAll stroke={2} size={14} />}
                onClick={() => {
                  setPromptLayers([]);
                }}
              >
                Clear layers
              </Button>
            </Group>

            <Accordion variant="separated">
              {promptLayers.map((layer, index) => (
                <Accordion.Item key={`${index}`} value={`${index}`}>
                  <Accordion.Control>
                    <Text>{layer.name}</Text>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Stack spacing={"md"}>
                      <TextInput
                        label="Layer name"
                        placeholder="Enter layer name"
                        value={layer.name}
                        onChange={(e) => {
                          const newLayers = [...promptLayers];
                          newLayers[index].name = e.currentTarget.value;
                          setPromptLayers(newLayers);
                        }}
                      />
                      <Textarea
                        label="Prompt"
                        placeholder="Enter prompt"
                        value={layer.prompt}
                        autosize
                        maxRows={5}
                        onChange={(e) => {
                          const newLayers = [...promptLayers];
                          newLayers[index].prompt = e.currentTarget.value;
                          setPromptLayers(newLayers);
                        }}
                      />
                      <Button
                        variant="outline"
                        fullWidth
                        color="red"
                        leftIcon={<IconTrash stroke={2} size={14} />}
                        onClick={() => {
                          const newLayers = [...promptLayers];
                          newLayers.splice(index, 1);
                          setPromptLayers(newLayers);
                        }}
                      >
                        Remove layer
                      </Button>
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>
          </Stack>
        </Aside>
      }
    >
      <Center>
        <Stack spacing={"xl"} align="start" w={"70%"} className={classes.chats}>
          {messages.map((message, index) => (
            <Stack w="100%" key={index}>
              <Flex gap="lg">
                <Avatar
                  src={
                    message.role === "assistant"
                      ? "/gpt_logo.jpg"
                      : user?.picture
                  }
                  radius={"md"}
                  size={"sm"}
                />
                <Text style={{ whiteSpace: "pre-wrap" }}>
                  {message.content}{" "}
                </Text>
              </Flex>
              <Divider opacity={0.5} />
            </Stack>
          ))}
          {isTyping && (
            <Group spacing={8}>
              <Loader variant="dots" size="sm" />
              <Text
                style={{
                  fontSize: 14,
                  fontStyle: "italic",
                }}
              >
                Typing...
              </Text>
            </Group>
          )}
        </Stack>
        <Textarea
          onKeyDown={getHotkeyHandler([["mod + enter", handleSubmission]])}
          classNames={{
            root: classes.textInputContainer,
            input: classes.textInput,
          }}
          autosize
          maxRows={4}
          placeholder="Send a message"
          radius={"md"}
          value={currentMessage}
          onChange={(event) => setCurrentMessage(event.currentTarget.value)}
          rightSection={
            <ActionIcon variant="subtle" onClick={handleSubmission}>
              <IconSend stroke={2} size={16} color="violet" />
            </ActionIcon>
          }
        />
      </Center>
    </AppShell>
  );
}

export default App;

const useStyles = createStyles({
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
    overflow: "hidden",
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
    position: "absolute",
    bottom: 0,
    left: 360,
    width: "50%",
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
    overflowY: "auto",
    height: "90vh",
  },
  savedGroup: {
    padding: 8,
    borderRadius: 8,
  },
  navList: {
    // overflowY: "scroll",
    // height: "85vh",
  },
});
