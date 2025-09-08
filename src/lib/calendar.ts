import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { ScheduleData } from './gmail';

export interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  location?: string;
  attendees?: Array<{
    email: string;
    responseStatus?: string;
  }>;
  conferenceData?: {
    createRequest?: {
      requestId: string;
      conferenceSolutionKey: {
        type: string;
      };
    };
  };
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingEventId?: string;
  similarity: number;
}

export class CalendarService {
  private oauth2Client: OAuth2Client;
  private calendar: any;

  constructor(oauth2Client: OAuth2Client) {
    this.oauth2Client = oauth2Client;
    this.calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  }

  /**
   * 予定データからCalendarEventを作成
   */
  private scheduleToCalendarEvent(schedule: ScheduleData): CalendarEvent {
    const event: CalendarEvent = {
      summary: schedule.title,
      description: schedule.description,
      start: {
        dateTime: schedule.startDate,
        timeZone: 'Asia/Tokyo',
      },
      end: {
        dateTime: schedule.endDate || this.addHours(schedule.startDate, 1),
        timeZone: 'Asia/Tokyo',
      },
    };

    if (schedule.location) {
      event.location = schedule.location;
    }

    // 会議URLがある場合はconferenceDataに設定
    if (schedule.meetingUrl) {
      const description = event.description || '';
      event.description = description + (description ? '\n\n' : '') + `会議URL: ${schedule.meetingUrl}`;
    }

    return event;
  }

  /**
   * 日時に時間を追加
   */
  private addHours(dateTimeStr: string, hours: number): string {
    const date = new Date(dateTimeStr);
    date.setHours(date.getHours() + hours);
    return date.toISOString();
  }

  /**
   * 重複チェック
   */
  async checkForDuplicates(
    schedule: ScheduleData,
    timeWindow: { start: string; end: string }
  ): Promise<DuplicateCheckResult> {
    try {
      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin: timeWindow.start,
        timeMax: timeWindow.end,
        singleEvents: true,
        orderBy: 'startTime',
      });

      const existingEvents = response.data.items || [];
      
      for (const event of existingEvents) {
        const similarity = this.calculateSimilarity(schedule, event);
        
        // 80%以上の類似度で重複とみなす
        if (similarity >= 0.8) {
          return {
            isDuplicate: true,
            existingEventId: event.id,
            similarity,
          };
        }
      }

      return {
        isDuplicate: false,
        similarity: 0,
      };
    } catch (error) {
      console.error('Failed to check for duplicates:', error);
      return {
        isDuplicate: false,
        similarity: 0,
      };
    }
  }

  /**
   * イベントの類似度を計算
   */
  private calculateSimilarity(schedule: ScheduleData, existingEvent: any): number {
    let similarity = 0;
    let factors = 0;

    // タイトルの類似度（重要度高）
    if (schedule.title && existingEvent.summary) {
      const titleSimilarity = this.stringSimilarity(
        schedule.title.toLowerCase(),
        existingEvent.summary.toLowerCase()
      );
      similarity += titleSimilarity * 0.5;
      factors += 0.5;
    }

    // 開始時刻の類似度
    if (schedule.startDate && existingEvent.start?.dateTime) {
      const scheduleStart = new Date(schedule.startDate);
      const existingStart = new Date(existingEvent.start.dateTime);
      const timeDiff = Math.abs(scheduleStart.getTime() - existingStart.getTime());
      
      // 30分以内なら高い類似度
      if (timeDiff <= 30 * 60 * 1000) {
        similarity += 0.3;
      } else if (timeDiff <= 2 * 60 * 60 * 1000) {
        // 2時間以内なら中程度
        similarity += 0.15;
      }
      factors += 0.3;
    }

    // 場所の類似度
    if (schedule.location && existingEvent.location) {
      const locationSimilarity = this.stringSimilarity(
        schedule.location.toLowerCase(),
        existingEvent.location.toLowerCase()
      );
      similarity += locationSimilarity * 0.2;
      factors += 0.2;
    }

    return factors > 0 ? similarity / factors : 0;
  }

  /**
   * 文字列の類似度を計算（Levenshtein距離ベース）
   */
  private stringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Levenshtein距離を計算
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * 予定を作成
   */
  async createEvent(schedule: ScheduleData): Promise<{
    success: boolean;
    eventId?: string;
    webLink?: string;
    error?: string;
  }> {
    try {
      // 重複チェック
      const scheduleDate = new Date(schedule.startDate);
      const timeWindow = {
        start: new Date(scheduleDate.getTime() - 2 * 60 * 60 * 1000).toISOString(), // 2時間前
        end: new Date(scheduleDate.getTime() + 4 * 60 * 60 * 1000).toISOString(),   // 4時間後
      };

      const duplicateCheck = await this.checkForDuplicates(schedule, timeWindow);
      
      if (duplicateCheck.isDuplicate) {
        return {
          success: false,
          error: `Similar event already exists (similarity: ${Math.round(duplicateCheck.similarity * 100)}%)`,
        };
      }

      // イベント作成
      const calendarEvent = this.scheduleToCalendarEvent(schedule);
      
      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        requestBody: calendarEvent,
        conferenceDataVersion: 1, // Google Meet生成用
      });

      console.log('Calendar event created:', response.data.id);
      
      return {
        success: true,
        eventId: response.data.id,
        webLink: response.data.htmlLink,
      };
    } catch (error) {
      console.error('Failed to create calendar event:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 予定を更新
   */
  async updateEvent(
    eventId: string,
    schedule: ScheduleData
  ): Promise<{
    success: boolean;
    webLink?: string;
    error?: string;
  }> {
    try {
      const calendarEvent = this.scheduleToCalendarEvent(schedule);
      
      const response = await this.calendar.events.update({
        calendarId: 'primary',
        eventId,
        requestBody: calendarEvent,
      });

      console.log('Calendar event updated:', eventId);
      
      return {
        success: true,
        webLink: response.data.htmlLink,
      };
    } catch (error) {
      console.error('Failed to update calendar event:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 予定を削除
   */
  async deleteEvent(eventId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      await this.calendar.events.delete({
        calendarId: 'primary',
        eventId,
      });

      console.log('Calendar event deleted:', eventId);
      
      return { success: true };
    } catch (error) {
      console.error('Failed to delete calendar event:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 予定の詳細を取得
   */
  async getEvent(eventId: string): Promise<CalendarEvent | null> {
    try {
      const response = await this.calendar.events.get({
        calendarId: 'primary',
        eventId,
      });

      return response.data;
    } catch (error) {
      console.error('Failed to get calendar event:', error);
      return null;
    }
  }

  /**
   * 指定期間の予定一覧を取得
   */
  async listEvents(
    timeMin: string,
    timeMax: string,
    maxResults: number = 50
  ): Promise<CalendarEvent[]> {
    try {
      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin,
        timeMax,
        maxResults,
        singleEvents: true,
        orderBy: 'startTime',
      });

      return response.data.items || [];
    } catch (error) {
      console.error('Failed to list calendar events:', error);
      return [];
    }
  }
} 