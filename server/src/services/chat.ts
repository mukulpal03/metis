import type { ModelMessage } from "ai";
import { db } from "../lib/db";

export class ChatService {
  async createConversation(
    userId: string,
    mode: string = "chat",
    title: string | null = null,
  ) {
    return db.conversation.create({
      data: {
        userId,
        mode,
        title: title || `New ${mode} conversation`,
      },
    });
  }

  async getOrCreateConversation(
    userId: string,
    conversationId: string | null = null,
    mode: string = "chat",
  ) {
    if (conversationId) {
      const conversation = await db.conversation.findFirst({
        where: {
          id: conversationId,
          userId,
        },
        include: {
          messages: {
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      });

      if (conversation) {
        return conversation;
      }
    }

    return await this.createConversation(userId, mode);
  }

  async addMessage(
    conversationId: string,
    role: string,
    content: string | object,
  ) {
    const textContent =
      typeof content === "string" ? content : JSON.stringify(content);

    return await db.message.create({
      data: {
        conversationId,
        role,
        content: textContent,
      },
    });
  }

  async getMessages(conversationId: string) {
    const messages = await db.message.findMany({
      where: {
        conversationId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Parse JSON content back to objects if needed
    return messages.map((msg) => ({
      ...msg,
      content: this.parseContent(msg.content),
    }));
  }

  async getUserConversations(userId: string, limit?: number) {
    return await db.conversation.findMany({
      where: {
        userId,
      },
      orderBy: {
        updatedAt: "desc",
      },
      include: {
        _count: {
          select: { messages: true },
        },
      },
      ...(limit ? { take: limit } : {}),
    });
  }

  async deleteConversation(conversationId: string, userId?: string) {
    return await db.conversation.deleteMany({
      where: {
        id: conversationId,
        ...(userId ? { userId } : {}),
      },
    });
  }

  async updateConversationTitle(
    conversationId: string,
    title: string,
    userId?: string,
  ) {
    if (userId) {
      const exists = await db.conversation.findFirst({
        where: { id: conversationId, userId },
      });

      if (!exists) {
        throw new Error("Conversation not found or unauthorized");
      }
    }

    return await db.conversation.update({
      where: {
        id: conversationId,
      },
      data: {
        title,
      },
    });
  }

  formatMessagesForAI(messages: Array<{ role: string; content: any }>): ModelMessage[] {
    return messages.map((msg) => ({
      role: msg.role as any,
      content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
    }));
  }

  private parseContent(content: string) {
    try {
      return JSON.parse(content);
    } catch {
      return content;
    }
  }
}
