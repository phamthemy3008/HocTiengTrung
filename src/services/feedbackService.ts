import { db } from '../firebase/config';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { FeedbackItem } from '../types';

class FeedbackService {
  async submitFeedback(data: {
    userId?: string;
    name?: string;
    email?: string;
    category?: 'content' | 'bug' | 'feature' | 'other';
    message: string;
  }): Promise<{ success: boolean; error?: string }> {
    const id = `fb-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newFeedback: FeedbackItem = {
      id,
      userId: data.userId || '',
      name: data.name?.trim() || 'Người học ẩn danh',
      email: data.email?.trim() || '',
      category: data.category || 'content',
      message: data.message.trim(),
      status: 'unread',
      createdAt: new Date().toISOString(),
    };

    // 1. Save to Cloud Firestore
    try {
      await setDoc(doc(db, 'feedback', id), newFeedback);
    } catch (err: any) {
      console.warn('Firestore write notice:', err);
    }

    // 2. Also notify server API as backup & instant memory log
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFeedback),
      });
    } catch {}

    return { success: true };
  }

  async fetchFeedbacks(): Promise<FeedbackItem[]> {
    try {
      const q = query(collection(db, 'feedback'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const items: FeedbackItem[] = [];
      snap.forEach((d) => {
        items.push(d.data() as FeedbackItem);
      });
      if (items.length > 0) return items;
    } catch (err) {
      console.warn('Firestore get feedbacks notice, trying server fallback:', err);
    }

    // Fallback: fetch from server API
    try {
      const res = await fetch('/api/feedback');
      const data = await res.json();
      if (data.success && Array.isArray(data.feedbacks)) {
        return data.feedbacks;
      }
    } catch {}

    return [];
  }

  async updateStatus(id: string, status: 'unread' | 'read' | 'resolved'): Promise<void> {
    try {
      await updateDoc(doc(db, 'feedback', id), { status });
    } catch (err) {
      console.warn('Update feedback status error in Firestore:', err);
    }

    try {
      await fetch(`/api/feedback/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
    } catch {}
  }

  async deleteFeedback(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'feedback', id));
    } catch (err) {
      console.warn('Delete feedback error in Firestore:', err);
    }

    try {
      await fetch(`/api/feedback/${id}`, {
        method: 'DELETE',
      });
    } catch {}
  }
}

export const feedbackService = new FeedbackService();
