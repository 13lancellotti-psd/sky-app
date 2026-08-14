import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import * as Speech from 'expo-speech';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";

const API_URL = 'https://sky-assistente-production.up.railway.app';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [recognizing, setRecognizing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const scrollViewRef = useRef();

  // Configurar reconhecimento de voz
  useEffect(() => {
    configureVoiceRecognition();
  }, []);

  const configureVoiceRecognition = async () => {
    try {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!result.granted) {
        console.warn('Permissão de microfone negada');
      }
    } catch (error) {
      console.error('Erro ao configurar voz:', error);
    }
  };

  // Listener de eventos de reconhecimento de voz
  useSpeechRecognitionEvent("start", () => {
    setRecognizing(true);
    setIsListening(true);
  });

  useSpeechRecognitionEvent("end", () => {
    setRecognizing(false);
    setIsListening(false);
  });

  useSpeechRecognitionEvent("result", (event) => {
    const transcriptText = event.results[0]?.transcript;
    if (transcriptText) {
      setTranscript(transcriptText);
      handleSendMessage(transcriptText);
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    console.error('Erro no reconhecimento:', event.error);
    setIsListening(false);
    setRecognizing(false);
  });

  // Iniciar escuta
  const startListening = async () => {
    try {
      await ExpoSpeechRecognitionModule.start({
        lang: "pt-BR",
        interimResults: true,
        maxAlternatives: 1,
        continuous: false,
        requiresOnDeviceRecognition: false,
      });
    } catch (error) {
      console.error('Erro ao iniciar escuta:', error);
      setIsListening(false);
    }
  };

  // Parar escuta
  const stopListening = async () => {
    try {
      await ExpoSpeechRecognitionModule.stop();
    } catch (error) {
      console.error('Erro ao parar escuta:', error);
    }
  };

  // Enviar mensagem para a API
  const handleSendMessage = async (text) => {
    if (!text || text.trim() === '') return;

    // Adicionar mensagem do usuário
    const userMessage = {
      id: Date.now(),
      text: text.trim(),
      sender: 'user',
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMessage]);
    setTranscript('');
    setIsThinking(true);

    try {
      // Criar conversa se não existir
      let convId = conversationId;
      if (!convId) {
        const convResponse = await fetch(`${API_URL}/api/conversation/new`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const convData = await convResponse.json();
        convId = convData.conversationId;
        setConversationId(convId);
      }

      // Enviar mensagem
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          conversationId: convId,
        }),
      });

      const data = await response.json();

      // Adicionar resposta da Sky
      const skyMessage = {
        id: Date.now() + 1,
        text: data.response,
        sender: 'sky',
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, skyMessage]);

      // Sky fala a resposta automaticamente
      speakText(data.response);

    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      const errorMessage = {
        id: Date.now() + 1,
        text: 'Desculpe, ocorreu um erro ao processar sua mensagem.',
        sender: 'sky',
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsThinking(false);
    }
  };

  // Sky fala o texto
  const speakText = (text) => {
    Speech.speak(text, {
      language: 'pt-BR',
      pitch: 1.1,
      rate: 1.0,
    });
  };

  // Toggle microfone
  const toggleMicrophone = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F0F1E" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoIcon}>🎙️</Text>
          <Text style={styles.logoText}>Sky</Text>
        </View>
        <View style={[styles.statusBadge, conversationId && styles.statusOnline]}>
          <View style={[styles.statusDot, conversationId && styles.statusDotOnline]} />
          <Text style={styles.statusText}>
            {conversationId ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>

      {/* Chat Container */}
      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 ? (
            <View style={styles.welcomeContainer}>
              <Text style={styles.welcomeIcon}>☁️</Text>
              <Text style={styles.welcomeTitle}>Olá! Eu sou a Sky</Text>
              <Text style={styles.welcomeText}>
                Sua assistente virtual inteligente. Como posso te ajudar hoje?
              </Text>
            </View>
          ) : (
            messages.map((msg) => (
              <View
                key={msg.id}
                style={[
                  styles.messageBubble,
                  msg.sender === 'user' ? styles.userBubble : styles.skyBubble,
                ]}
              >
                <Text style={styles.messageText}>{msg.text}</Text>
                <Text style={styles.messageTime}>{msg.time}</Text>
              </View>
            ))
          )}

          {isThinking && (
            <View style={styles.thinkingContainer}>
              <ActivityIndicator size="small" color="#6C5CE7" />
              <Text style={styles.thinkingText}>Sky está pensando...</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Voice Visualizer */}
      {isListening && (
        <View style={styles.visualizer}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={styles.wave} />
          ))}
        </View>
      )}

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.micButton, isListening && styles.micButtonActive]}
          onPress={toggleMicrophone}
          activeOpacity={0.8}
        >
          <Text style={styles.micIcon}>{isListening ? '⏹️' : '🎤'}</Text>
          <Text style={styles.micText}>
            {isListening ? 'Estou ouvindo...' : 'Toque para falar'}
          </Text>
        </TouchableOpacity>

        {recognizing && transcript && (
          <View style={styles.transcriptContainer}>
            <Text style={styles.transcriptText}>{transcript}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F1E',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 15,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoIcon: {
    fontSize: 32,
    marginRight: 10,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#6C5CE7',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A2E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusOnline: {
    backgroundColor: '#1A2E1A',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF6B6B',
    marginRight: 6,
  },
  statusDotOnline: {
    backgroundColor: '#51CF66',
  },
  statusText: {
    fontSize: 12,
    color: '#A0A0B0',
    fontWeight: '500',
  },
  chatContainer: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
    padding: 20,
  },
  messagesContent: {
    flexGrow: 1,
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  welcomeIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  welcomeText: {
    fontSize: 16,
    color: '#A0A0B0',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 18,
    marginBottom: 12,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#6C5CE7',
  },
  skyBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#2D2D44',
  },
  messageText: {
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 22,
  },
  messageTime: {
    fontSize: 11,
    color: '#A0A0B0',
    marginTop: 4,
  },
  thinkingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 12,
  },
  thinkingText: {
    fontSize: 14,
    color: '#A0A0B0',
    marginLeft: 8,
  },
  visualizer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 60,
    gap: 4,
  },
  wave: {
    width: 4,
    height: 20,
    backgroundColor: '#6C5CE7',
    borderRadius: 4,
  },
  controls: {
    padding: 20,
  },
  micButton: {
    backgroundColor: '#6C5CE7',
    paddingVertical: 20,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  micButtonActive: {
    backgroundColor: '#FF6B6B',
  },
  micIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  micText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  transcriptContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
  },
  transcriptText: {
    fontSize: 14,
    color: '#A0A0B0',
    fontStyle: 'italic',
  },
});
