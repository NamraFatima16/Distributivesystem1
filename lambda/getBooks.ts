import { Handler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const ddbDocClient = createDDbDocClient();

export const handler: Handler = async (event, context) => {
  try {
    console.log("Retrieving books. Event: ", JSON.stringify(event));
    const author = event.pathParameters?.author;
    const genre = event.queryStringParameters?.genre;

    if (!author) {
      return {
        statusCode: 400,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ Message: "Missing author path parameter." }),
      };
    }

    let queryParams = {
      TableName: process.env.TABLE_NAME,
      KeyConditionExpression: "Author = :author",
      ExpressionAttributeValues: { ":author": author },
    };

    if (genre) {
      queryParams = {
        ...queryParams,
        FilterExpression: "Genre = :genre",
        ExpressionAttributeValues: { ...queryParams.ExpressionAttributeValues, ":genre": genre },
      };
    }

    const commandOutput = await ddbDocClient.send(new QueryCommand(queryParams));

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(commandOutput.Items),
    };
  } catch (error: any) {
    console.log("Error retrieving books: ", JSON.stringify(error));
    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ error: "Failed to retrieve books." }),
    };
  }
};

function createDDbDocClient() {
  const ddbClient = new DynamoDBClient({ region: process.env.REGION });
  const marshallOptions = {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  };
  const unmarshallOptions = {
    wrapNumbers: false,
  };
  const translateConfig = { marshallOptions, unmarshallOptions };
  return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}
