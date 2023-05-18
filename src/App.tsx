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
import {
  IconBoxMultiple,
  IconFlame,
  IconFlameOff,
  IconLock,
  IconMoonStars,
  IconPlus,
  IconSend,
  IconSettings,
  IconSun,
  IconTrash,
} from "@tabler/icons-react";
import { CreateChatCompletionRequest } from "openai";
import { useState } from "react";
import { openai } from "./modules/openai";

interface PromptLayer {
  name: string;
  prompt: string;
}

// const DisplayText = ({ text }: { text: string }) => {
//   const editor = useEditor({
//     editable: false,
//     extensions: [StarterKit, ],
//     content: text,
//     editorProps: {

//     }
//   });

//   return (
//     <RichTextEditor editor={editor}>
//       <RichTextEditor.Content style={{whiteSpace: 'pre-wrap'}}/>
//     </RichTextEditor>
//   );
// };

function App() {
  const { classes } = useStyles();
  // const [opened, { open, close }] = useDisclosure(false);
  const [showControls, setShowControls] = useState<boolean>(false);
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const dark = colorScheme === "dark";
  const { loginWithRedirect, isLoading, logout, user } = useAuth0();
  const [currentMessage, setCurrentMessage] = useState<string>("");
  const [isTyping, setIsTyping] = useState<boolean>(false);
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

  useHotkeys([["mod+shift+C", () => setShowControls((c) => !c)]]);

  const addMessage = (message: string) => {
    setMessages((prev) => [...prev, { role: "user", content: message }]);
  };

  const sendChat = async (
    messages: CreateChatCompletionRequest["messages"]
  ) => {
    setIsTyping(true);
    try {
      console.log("messages", messages);
      const response = await openai.createChatCompletion({
        ...config,
        messages: messages,
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
    } catch (error) {
      console.log(error);
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
    addMessage(currentMessage);
    const newPrompt = buildPrompt(currentMessage);

    const newMessage = {
      role: "user" as CreateChatCompletionRequest["messages"][0]["role"],
      content: newPrompt,
    };
    const newMessages: CreateChatCompletionRequest["messages"] = [
      ...messages,
      newMessage,
    ];

    await sendChat(newMessages);
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
          overlayProps={{ blur: 15 }}
          radius={"md"}
          style={{
            backgroundColor: dark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.5)",
          }}
        >
          <Center>
            <Stack spacing={"xl"} align="center">
              <Stack spacing={4} align="center">
                <Title order={3}>GPT-API</Title>
                <Text size={14} color="gray">
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
            <Stack w={"100%"}>
              <Button
                variant="outline"
                fullWidth
                leftIcon={<IconPlus stroke={2} size={14} />}
                disabled
              >
                New Chat
              </Button>
            </Stack>
            <Stack w={"100%"} spacing={4}>
              <Button
                fullWidth
                variant="subtle"
                onClick={() => toggleColorScheme()}
                title="Toggle color scheme"
                leftIcon={
                  dark ? (
                    <IconSun size="1.1rem" />
                  ) : (
                    <IconMoonStars size="1.1rem" />
                  )
                }
              >
                Switch theme to {dark ? "light" : "dark"}
              </Button>
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
          <Stack spacing={"xl"} align="left" p={"md"}>
            <Group spacing={4}>
              <IconBoxMultiple size={16} />
              <Title order={4}>Layers</Title>
            </Group>
            <Button
              variant="outline"
              fullWidth
              leftIcon={<IconPlus stroke={2} size={14} />}
              onClick={() =>
                setPromptLayers((prev) => [...prev, { name: "", prompt: "" }])
              }
            >
              Add layer
            </Button>

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
    overflowY: "scroll",
    height: "90vh",
  },
});
