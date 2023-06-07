import { ZBClient } from "zeebe-node";
import { v4 as uuid } from "uuid";
import { config } from "dotenv";
import axios from "axios";

config();
const zbc = new ZBClient();

const baseURL = "http://localhost:3000";

interface ProcessPayload {
  employee_id: number;
  date: string;
  sum: number;
  description: string;
  current_year_expenses?: number;
  account?: boolean;
}

axios
  .get("http://localhost:3000/expense_reports")
  .then(function (response) {
    // handle success
    console.log(response.data);
  })
  .catch(function (error) {
    // handle error
    console.log(error);
  })
  .finally(function () {
    // always executed
  });

zbc.createWorker<ProcessPayload, {}, Partial<ProcessPayload>>({
  taskType: "check_account",
  taskHandler: async (job) => {
    // Überprüfe auf Konto
    console.log(`Überprüfe auf Konto...`);

    try {
      const response = await axios.get(
        `${baseURL}/accounts/${job.variables.employee_id}`
      );
      if (response.status === 200) {
        console.log(`Account exists for employee: ${job.variables.employee_id}`);
        return job.complete({ account: true });
      } else {
        console.log(`Unexpected response status: ${response.status}`);
        return job.fail(`Unexpected response status: ${response.status}`);
      }
    } catch (error) {
        console.log(`Error: ${error}`);
      if (axios.isAxiosError(error)) {
        if (error.response && error.response.status === 404) {
          console.log(`Account does not exist for employee: ${job.variables.employee_id}`);
          return job.complete({ account: false });
        } 
      } else {
        console.error(`Unbekannter Fehler: ${error}`);
      }

      return job.fail(`Fehler beim Überprüfen des Kontos: ${error}`);
    }
  },
});

zbc.createWorker<ProcessPayload, {}, Partial<ProcessPayload>>({
  taskType: "create_account",
  taskHandler: async (job) => {
    // Erstelle neues Konto
    console.log("Erstelle neues Konto...");

    const accountData = {
      id: job.variables.employee_id,
      balance: 0,
      current_year_expenses: 0,
    };

    try {
      const response = await axios.post(`${baseURL}/accounts`, accountData);

      console.log("Konto erfolgreich erstellt");
      return job.complete();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("Fehler beim Erstellen des Kontos:", error.message);
      } else {
        console.error("Unbekannter Fehler:", error);
      }

      return job.fail("Fehler beim Erstellen des Kontos:");
    }
  },
});

zbc.createWorker<ProcessPayload, {}, Partial<ProcessPayload>>({
  taskType: "approve_expense",
  taskHandler: async (job) => {
    var accountData = {
        balance: -1,
        current_year_expenses: -1
    }

    await axios.get(`${baseURL}/accounts/${job.variables.employee_id}`)
  .then(function (response) {
    const account = response.data;
    console.log(`Account: ${account.id}, ${account.balance}, ${account.current_year_expenses}`);
    if (account) {
        accountData = {
            balance: account.balance + job.variables.sum,
            current_year_expenses: account.current_year_expenses  + 1
        }
      
    } else {
      console.log('Account not found');
    }
  })
  .catch(function (error) {
    console.error('Error retrieving account:', error);
  });

    console.log(`accountData: ${accountData.balance}, ${accountData.current_year_expenses}`);

    await axios
      .patch(`${baseURL}/accounts/${job.variables.employee_id}`, accountData)
      .then(function (response) {
        console.log("Account balance updated successfully:", response.data);
      })
      .catch(function (error) {
        console.error("Error updating account balance:", error);
      });
    console.log(`Genehmige Ausgabe...`);
    return job.complete();
  },
});


zbc.createWorker<ProcessPayload, {}, Partial<ProcessPayload>>({
    taskType: "get_current_year_expenses",
    taskHandler: async (job) => {
      console.log(`Spesen pro Jahr abfragen...`);
      try {
        const response = await axios.get(`${baseURL}/accounts/${job.variables.employee_id}`);
        const account = response.data;
        console.log(`Account: ${account.id}, ${account.balance}, ${account.current_year_expenses}`);
        if (account) {
          const current_year_expenses = account.current_year_expenses;
          // return the promise from job.complete() directly
          return job.complete({ current_year_expenses });
        } else {
          console.log('Account not found');
          return job.fail(`Account not found`);
          // handle the case when account is not found
        }
      } catch (error) {
        console.error(`Error: ${error}`);
        // handle the error, and ensure that a job action is returned
        return job.fail(`Error: ${error}`);
      }
    },
  });
  
